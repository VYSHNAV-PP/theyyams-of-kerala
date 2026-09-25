import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LocateFixed,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  CATEGORY_META,
  type KEvent,
} from "@/lib/events";
import {
  KERALA_BOUNDS,
  loadDistrictGeo,
} from "@/lib/geo";

export type Viewport = {
  zoom: number;
  bounds: [number, number, number, number];
};

type Props = {
  events: KEvent[];
  selectedId?: string | null;

  focus?: {
    id: string;
    lat: number;
    lng: number;
  } | null;

  onSelect?: (e: KEvent) => void;
  onViewport?: (v: Viewport) => void;
  onLocate?: (lat: number, lng: number) => void;

  fit?: {
    key: string;
    bounds:
      | [[number, number], [number, number]]
      | null;
  };

  pick?: {
    lat: number;
    lng: number;
  } | null;

  onPick?: (lat: number, lng: number) => void;

  initialView?: {
    lat: number;
    lng: number;
    zoom: number;
  };

  compact?: boolean;
  className?: string;
};

type SearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

function pinIcon(
  hex: string,
  glyph: string,
  selected: boolean,
) {
  const w = selected ? 38 : 30;
  const h = selected ? 50 : 40;

  return L.divIcon({
    className: "ke-pin",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    html: `
      <svg
        width="${w}"
        height="${h}"
        viewBox="0 0 30 40"
        aria-hidden="true"
      >
        <path
          d="M15 1C7.3 1 1.5 6.9 1.5 14.2
             1.5 24 15 39 15 39
             S28.5 24 28.5 14.2
             C28.5 6.9 22.7 1 15 1z"
          fill="${hex}"
          stroke="${selected ? "#111" : "#fff"}"
          stroke-width="${selected ? 3 : 2}"
        />
        <circle
          cx="15"
          cy="14.5"
          r="9"
          fill="#fff"
        />
        <text
          x="15"
          y="18.5"
          font-size="11"
          text-anchor="middle"
        >
          ${glyph}
        </text>
      </svg>
    `,
  });
}

function clusterIcon(
  count: number,
  label?: string,
) {
  return L.divIcon({
    className: "ke-cluster-wrap",
    iconSize: [56, label ? 60 : 44],
    iconAnchor: [28, label ? 30 : 22],
    html: `
      <div class="ke-cluster">
        <b>${count}</b>
      </div>
      ${
        label
          ? `<div class="ke-cluster-label">${label}</div>`
          : ""
      }
    `,
  });
}

/*
 * Extract the outer rings of Kerala's districts.
 *
 * These rings are used as holes in the grey overlay,
 * allowing the normal map to remain visible inside Kerala.
 */
function extractKeralaRings(
  geo: any,
): [number, number][][] {
  const rings: [number, number][][] = [];

  for (const feature of geo?.features ?? []) {
    const geometry = feature?.geometry;

    if (!geometry) continue;

    if (geometry.type === "Polygon") {
      const outer =
        geometry.coordinates?.[0];

      if (
        Array.isArray(outer) &&
        outer.length >= 3
      ) {
        rings.push(
          outer.map(
            ([lng, lat]: [
              number,
              number,
            ]) =>
              [lat, lng] as [
                number,
                number,
              ],
          ),
        );
      }
    }

    if (
      geometry.type ===
      "MultiPolygon"
    ) {
      for (const polygon of
        geometry.coordinates ?? []) {
        const outer =
          polygon?.[0];

        if (
          Array.isArray(outer) &&
          outer.length >= 3
        ) {
          rings.push(
            outer.map(
              ([lng, lat]: [
                number,
                number,
              ]) =>
                [lat, lng] as [
                  number,
                  number,
                ],
            ),
          );
        }
      }
    }
  }

  return rings;
}

export default function EventMap(
  p: Props,
) {
  const box =
    useRef<HTMLDivElement>(null);

  const el =
    useRef<HTMLDivElement>(null);

  const map =
    useRef<L.Map | null>(null);

  const layer =
    useRef<L.LayerGroup | null>(null);

  const pickMk =
    useRef<L.Marker | null>(null);

  const meMk =
    useRef<L.CircleMarker | null>(
      null,
    );

  const props =
    useRef(p);

  props.current = p;

  const placeSearchTimer =
    useRef<number | null>(null);

  const [note, setNote] =
    useState("");

  const [full, setFull] =
    useState(false);

  const [canFull, setCanFull] =
    useState(false);

  const [placeQuery, setPlaceQuery] =
    useState("");

  const [
    placeResults,
    setPlaceResults,
  ] = useState<SearchResult[]>(
    [],
  );

  const [
    placeSearching,
    setPlaceSearching,
  ] = useState(false);

  const [
    placeSearchOpen,
    setPlaceSearchOpen,
  ] = useState(false);

  /*
   * ============================================================
   * DRAW MAP MARKERS
   *
   * Zoom <= 8:
   *   One marker per district with total event count.
   *
   * Zoom > 8:
   *   Show every event individually.
   * ============================================================
   */
  const draw = useCallback(() => {
    const m = map.current;
    const g = layer.current;

    if (!m || !g) return;

    g.clearLayers();

    const {
      events,
      selectedId,
      onSelect,
    } = props.current;

    const zoom = m.getZoom();

    const view =
      m.getBounds().pad(0.3);

    const DISTRICT_ZOOM = 8;

    if (zoom <= DISTRICT_ZOOM) {
      const districtGroups =
        new Map<
          string,
          KEvent[]
        >();

      for (const event of events) {
        if (!event.district) {
          continue;
        }

        const existing =
          districtGroups.get(
            event.district,
          );

        if (existing) {
          existing.push(event);
        } else {
          districtGroups.set(
            event.district,
            [event],
          );
        }
      }

      for (const [
        district,
        districtEvents,
      ] of districtGroups) {
        if (
          districtEvents.length === 0
        ) {
          continue;
        }

        const lat =
          districtEvents.reduce(
            (sum, event) =>
              sum + event.lat,
            0,
          ) /
          districtEvents.length;

        const lng =
          districtEvents.reduce(
            (sum, event) =>
              sum + event.lng,
            0,
          ) /
          districtEvents.length;

        const marker =
          L.marker(
            [lat, lng],
            {
              pane:
                "eventMarkers",

              icon:
                clusterIcon(
                  districtEvents.length,
                  district,
                ),

              title: `${district} — ${districtEvents.length} ${
                districtEvents.length ===
                1
                  ? "event"
                  : "events"
              }`,
            },
          );

        marker.on(
          "click",
          () => {
            const bounds =
              L.latLngBounds(
                districtEvents.map(
                  (event) =>
                    [
                      event.lat,
                      event.lng,
                    ] as [
                      number,
                      number,
                    ],
                ),
              );

            m.fitBounds(
              bounds,
              {
                padding: [
                  60,
                  60,
                ],
                maxZoom: 13,
                animate: true,
              },
            );
          },
        );

        marker.addTo(g);
      }

      return;
    }

    const seen =
      new Map<string, number>();

    for (const event of events) {
      if (
        !view.contains([
          event.lat,
          event.lng,
        ])
      ) {
        continue;
      }

      const coordinateKey =
        `${event.lat},${event.lng}`;

      const occurrence =
        seen.get(
          coordinateKey,
        ) ?? 0;

      seen.set(
        coordinateKey,
        occurrence + 1,
      );

      const offset =
        occurrence * 0.00007;

      const meta =
        CATEGORY_META[
          event.category
        ];

      const marker =
        L.marker(
          [
            event.lat +
              offset,
            event.lng +
              offset,
          ],
          {
            pane:
              "eventMarkers",

            icon:
              pinIcon(
                meta.hex,
                meta.icon,
                event.id ===
                  selectedId,
              ),

            title:
              event.title,

            zIndexOffset:
              event.id ===
              selectedId
                ? 1000
                : 0,

            riseOnHover:
              true,
          },
        );

      marker.on(
        "click",
        () => {
          onSelect?.(event);
        },
      );

      marker.addTo(g);
    }
  }, []);

  async function searchPlaces(
    query: string,
  ) {
    const trimmed =
      query.trim();

    if (trimmed.length < 2) {
      setPlaceResults([]);
      setPlaceSearchOpen(false);
      return;
    }

    setPlaceSearching(true);

    try {
      const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
          q: `${trimmed}, Kerala, India`,
          format: "jsonv2",
          limit: "8",
          countrycodes: "in",
          addressdetails: "1",
        }).toString();

      const response =
        await fetch(url, {
          headers: {
            Accept:
              "application/json",
          },
        });

      if (!response.ok) {
        throw new Error(
          "Place search failed",
        );
      }

      const data =
        (await response.json()) as SearchResult[];

      const [
        [south, west],
        [north, east],
      ] = KERALA_BOUNDS;

      const keralaResults =
        data.filter(
          (result) => {
            const lat =
              Number(result.lat);

            const lng =
              Number(result.lon);

            return (
              Number.isFinite(
                lat,
              ) &&
              Number.isFinite(
                lng,
              ) &&
              lat >= south &&
              lat <= north &&
              lng >= west &&
              lng <= east
            );
          },
        );

      setPlaceResults(
        keralaResults.slice(
          0,
          5,
        ),
      );

      setPlaceSearchOpen(
        keralaResults.length >
          0,
      );
    } catch {
      setPlaceResults([]);
      setPlaceSearchOpen(false);
    } finally {
      setPlaceSearching(false);
    }
  }

  function handlePlaceQueryChange(
    value: string,
  ) {
    setPlaceQuery(value);

    if (
      placeSearchTimer.current
    ) {
      window.clearTimeout(
        placeSearchTimer.current,
      );
    }

    if (
      value.trim().length < 2
    ) {
      setPlaceResults([]);
      setPlaceSearchOpen(false);
      return;
    }

    placeSearchTimer.current =
      window.setTimeout(
        () => {
          void searchPlaces(
            value,
          );
        },
        500,
      );
  }

  function selectPlace(
    result: SearchResult,
  ) {
    const lat =
      Number(result.lat);

    const lng =
      Number(result.lon);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return;
    }

    const m = map.current;

    if (!m) return;

    props.current.onPick?.(
      lat,
      lng,
    );

    m.flyTo(
      [lat, lng],
      Math.max(
        m.getZoom(),
        15,
      ),
      {
        duration: 0.7,
      },
    );

    setPlaceQuery(
      result.display_name
        .split(",")[0] ??
        result.display_name,
    );

    setPlaceResults([]);
    setPlaceSearchOpen(false);
  }

  useEffect(() => {
    if (!el.current) return;

    const m = L.map(
      el.current,
      {
        zoomControl: false,
        minZoom: 6,
        maxBounds:
          L.latLngBounds(
            KERALA_BOUNDS,
          ).pad(0.8),
        maxBoundsViscosity: 0.7,
      },
    );

    const initial =
      props.current.initialView;

    if (initial) {
      m.setView(
        [
          initial.lat,
          initial.lng,
        ],
        initial.zoom,
      );
    } else {
      /*
       * Start with a reasonable Kerala-wide
       * fallback view until the actual GeoJSON
       * boundary is loaded.
       */
      m.setView(
        [10.35, 76.25],
        8.5,
      );
    }

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      },
    ).addTo(m);

    m.createPane(
      "outsideKerala",
    );

    const outsidePane =
      m.getPane(
        "outsideKerala",
      );

    if (outsidePane) {
      outsidePane.style.zIndex =
        "350";

      outsidePane.style.pointerEvents =
        "none";
    }

    m.createPane(
      "keralaBoundary",
    );

    const boundaryPane =
      m.getPane(
        "keralaBoundary",
      );

    if (boundaryPane) {
      boundaryPane.style.zIndex =
        "450";

      boundaryPane.style.pointerEvents =
        "none";
    }

    m.createPane(
      "eventMarkers",
    );

    const eventPane =
      m.getPane(
        "eventMarkers",
      );

    if (eventPane) {
      eventPane.style.zIndex =
        "500";
    }

    layer.current =
      L.layerGroup().addTo(m);

    map.current = m;

    void loadDistrictGeo().then(
      (geo) => {
        if (
          !geo ||
          map.current !== m
        ) {
          return;
        }

        const rings =
          extractKeralaRings(
            geo,
          );

        /*
         * Fit to the ACTUAL GeoJSON bounds,
         * not the larger KERALA_BOUNDS rectangle.
         *
         * This makes the whole of Kerala visible
         * while keeping the map as close as possible.
         */
        if (
          !initial &&
          rings.length > 0
        ) {
          const actualKeralaBounds =
            L.latLngBounds(
              rings.flat(),
            );

          m.fitBounds(
            actualKeralaBounds,
            {
              padding: [
                18,
                18,
              ],
              animate: false,
              maxZoom: 9,
            },
          );
        }

        const world: [
          number,
          number,
        ][] = [
          [90, -180],
          [90, 180],
          [-90, 180],
          [-90, -180],
          [90, -180],
        ];

        if (
          rings.length > 0
        ) {
          L.polygon(
            [
              world,
              ...rings,
            ] as L.LatLngExpression[][],
            {
              pane:
                "outsideKerala",

              stroke: false,

              fillColor:
                "#d1d5db",

              fillOpacity:
                0.62,

              fillRule:
                "evenodd",

              interactive: false,
            },
          ).addTo(m);
        }

        L.geoJSON(
          geo as never,
          {
            pane:
              "keralaBoundary",

            interactive: false,

            style: {
              color:
                "#0f5c4d",

              weight: 1.3,

              fillColor:
                "#0f5c4d",

              fillOpacity:
                0.06,
            },
          },
        ).addTo(m);

        draw();
      },
    );

    m.on(
      "moveend",
      () => {
        draw();

        const bounds =
          m.getBounds();

        props.current
          .onViewport?.({
            zoom:
              m.getZoom(),

            bounds: [
              bounds.getSouth(),
              bounds.getWest(),
              bounds.getNorth(),
              bounds.getEast(),
            ],
          });
      },
    );

    m.on(
      "click",
      (
        event: L.LeafletMouseEvent,
      ) => {
        props.current
          .onPick?.(
            event.latlng.lat,
            event.latlng.lng,
          );
      },
    );

    const resizeObserver =
      new ResizeObserver(
        () => {
          m.invalidateSize();
        },
      );

    resizeObserver.observe(
      el.current,
    );

    draw();

    setCanFull(
      !!document.fullscreenEnabled,
    );

    const onFullscreen =
      () => {
        setFull(
          !!document.fullscreenElement,
        );
      };

    document.addEventListener(
      "fullscreenchange",
      onFullscreen,
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        onFullscreen,
      );

      if (
        placeSearchTimer.current
      ) {
        window.clearTimeout(
          placeSearchTimer.current,
        );

        placeSearchTimer.current =
          null;
      }

      resizeObserver.disconnect();

      m.remove();

      map.current = null;
      layer.current = null;
      pickMk.current = null;
      meMk.current = null;
    };
  }, [draw]);

  useEffect(() => {
    draw();
  }, [
    p.events,
    p.selectedId,
    draw,
  ]);

  useEffect(() => {
    const m = map.current;

    const bounds =
      props.current.fit?.bounds;

    if (m && bounds) {
      m.fitBounds(
        bounds,
        {
          padding: [
            40,
            40,
          ],
          maxZoom: 13,
        },
      );
    }
  }, [p.fit?.key]);

  useEffect(() => {
    const m = map.current;

    const focus =
      props.current.focus;

    if (m && focus) {
      m.flyTo(
        [
          focus.lat,
          focus.lng,
        ],
        Math.max(
          m.getZoom(),
          13,
        ),
        {
          duration: 0.6,
        },
      );
    }
  }, [p.focus?.id]);

  useEffect(() => {
    const m = map.current;

    if (
      !m ||
      !p.onPick
    ) {
      return;
    }

    if (!p.pick) {
      pickMk.current?.remove();

      pickMk.current =
        null;

      return;
    }

    const location =
      L.latLng(
        p.pick.lat,
        p.pick.lng,
      );

    if (pickMk.current) {
      pickMk.current.setLatLng(
        location,
      );

      return;
    }

    const marker =
      L.marker(
        location,
        {
          pane:
            "eventMarkers",

          draggable: true,

          icon:
            pinIcon(
              "#c2410c",
              "📍",
              true,
            ),

          title:
            "Event location — drag to adjust",
        },
      ).addTo(m);

    marker.on(
      "dragend",
      () => {
        const position =
          marker.getLatLng();

        props.current
          .onPick?.(
            position.lat,
            position.lng,
          );
      },
    );

    pickMk.current =
      marker;
  }, [
    p.pick,
    p.onPick,
  ]);

  function say(
    message: string,
  ) {
    setNote(message);

    if (message) {
      window.setTimeout(
        () => {
          setNote("");
        },
        4500,
      );
    }
  }

  function locate() {
    const m = map.current;

    if (!m) return;

    if (
      !navigator.geolocation
    ) {
      say(
        "Location isn't available on this device.",
      );

      return;
    }

    say(
      "Finding your location…",
    );

    navigator.geolocation.getCurrentPosition(
      ({
        coords: {
          latitude,
          longitude,
        },
      }) => {
        const [
          [south, west],
          [north, east],
        ] = KERALA_BOUNDS;

        if (
          latitude < south ||
          latitude > north ||
          longitude < west ||
          longitude > east
        ) {
          say(
            "You seem to be outside Kerala, so we've kept the Kerala view.",
          );

          return;
        }

        setNote("");

        meMk.current?.remove();

        meMk.current =
          L.circleMarker(
            [
              latitude,
              longitude,
            ],
            {
              pane:
                "eventMarkers",

              radius: 8,

              color: "#fff",

              weight: 3,

              fillColor:
                "#2563eb",

              fillOpacity: 1,

              interactive: false,
            },
          ).addTo(m);

        m.flyTo(
          [
            latitude,
            longitude,
          ],
          12,
          {
            duration: 0.8,
          },
        );

        props.current
          .onLocate?.(
            latitude,
            longitude,
          );
      },
      () => {
        say(
          "Location permission was declined. You can still explore by district.",
        );
      },
      {
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  function toggleFullscreen() {
    if (
      document.fullscreenElement
    ) {
      void document.exitFullscreen();
    } else {
      void box.current
        ?.requestFullscreen?.();
    }
  }

  const buttonClass =
    "flex h-10 w-10 items-center justify-center border-b border-border bg-card text-foreground first:rounded-t-md last:rounded-b-md last:border-b-0 hover:bg-muted focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <div
      ref={box}
      className={`relative isolate ${
        p.className ??
        "h-full w-full"
      }`}
    >
      <div
        ref={el}
        className="absolute inset-0 bg-muted"
        role="application"
        aria-label="Interactive map of events in Kerala"
      />

      {p.onPick && (
        <div className="absolute left-3 top-3 z-[500] w-[min(380px,calc(100%-6rem))]">
          <div className="relative">
            <div className="flex items-center rounded-md border border-border bg-card shadow-sm">
              <Search
                size={17}
                className="ml-3 shrink-0 text-muted-foreground"
              />

              <input
                type="text"
                value={placeQuery}
                onChange={(event) =>
                  handlePlaceQueryChange(
                    event.target.value,
                  )
                }
                onFocus={() => {
                  if (
                    placeResults.length >
                    0
                  ) {
                    setPlaceSearchOpen(
                      true,
                    );
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Escape"
                  ) {
                    setPlaceSearchOpen(
                      false,
                    );
                  }
                }}
                placeholder="Search a place or venue…"
                className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                aria-label="Search for event location"
              />

              {placeSearching && (
                <div className="mr-3 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
              )}
            </div>

            {placeSearchOpen &&
              placeResults.length >
                0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-md border border-border bg-card shadow-lg">
                  {placeResults.map(
                    (result) => {
                      const parts =
                        result.display_name.split(
                          ",",
                        );

                      const title =
                        parts
                          .slice(
                            0,
                            2,
                          )
                          .join(
                            ",",
                          )
                          .trim();

                      return (
                        <button
                          key={
                            result.place_id
                          }
                          type="button"
                          className="block w-full border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                          onClick={() =>
                            selectPlace(
                              result,
                            )
                          }
                        >
                          <div className="text-sm font-medium text-foreground">
                            {
                              title
                            }
                          </div>

                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {
                              result.display_name
                            }
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
          </div>
        </div>
      )}

      <div
        className="absolute right-3 top-3 z-[500] flex flex-col overflow-hidden rounded-md border border-border shadow-sm"
        role="group"
        aria-label="Map controls"
      >
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            map.current?.zoomIn()
          }
          aria-label="Zoom in"
        >
          <Plus size={18} />
        </button>

        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            map.current?.zoomOut()
          }
          aria-label="Zoom out"
        >
          <Minus size={18} />
        </button>

        {!p.compact && (
          <button
            type="button"
            className={buttonClass}
            onClick={locate}
            aria-label="Show my location"
            title="Show my location"
          >
            <LocateFixed
              size={18}
            />
          </button>
        )}

        {!p.compact && (
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              map.current?.fitBounds(
                KERALA_BOUNDS,
              )
            }
            aria-label="Reset to Kerala"
            title="Reset to Kerala"
          >
            <RotateCcw
              size={18}
            />
          </button>
        )}

        {!p.compact &&
          canFull && (
            <button
              type="button"
              className={buttonClass}
              onClick={
                toggleFullscreen
              }
              aria-label={
                full
                  ? "Exit full screen"
                  : "Full screen"
              }
            >
              {full ? (
                <Minimize2
                  size={18}
                />
              ) : (
                <Maximize2
                  size={18}
                />
              )}
            </button>
          )}
      </div>

      {note && (
        <p
          role="status"
          className="absolute left-1/2 top-3 z-[500] max-w-[80%] -translate-x-1/2 rounded-md bg-foreground px-3 py-1.5 text-center text-xs text-background shadow"
        >
          {note}
        </p>
      )}
    </div>
  );
}