import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A picture slot with a fixed shape. If the file is not there yet it shows the placeholder,
 * so the layout is already right when the pictures are added later.
 */
export function SlotImage({
  src,
  alt = "",
  className = "",
  placeholder,
}: {
  src: string;
  alt?: string;
  className?: string;
  placeholder?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFailed(false);
    // An image can fail before React attaches its error handler (during hydration),
    // so check the element once it is mounted.
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-raised ${className}`}>
      {!failed && (
        <img
          ref={ref}
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
          {placeholder ?? <ImagePlus size={26} className="text-subtle" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}
