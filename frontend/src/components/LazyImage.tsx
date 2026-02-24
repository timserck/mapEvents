import React, { useState } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
}

export default function LazyImage({
  src,
  alt,
  className,
  placeholderColor = "#ccc",
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      style={{
        backgroundColor: placeholderColor,
        width: "100%",
        height: "160px",
        borderRadius: "0.5rem",
        overflow: "hidden",
        position: "relative",
      }}
      className={className}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.3s ease-in-out",
          position: "absolute",
          top: 0,
          left: 0,
        }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

