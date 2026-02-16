import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export default function RouteToggleButton({ toggleRoute, showRoute, routeMode, setRouteMode }) {
  const map = useMap();

  useEffect(() => {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
    container.style.background = "white";
    container.style.padding = "6px";
    container.style.borderRadius = "6px";
    container.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "4px";

    const btn = L.DomUtil.create("button", "", container);
    btn.innerHTML = showRoute ? "❌ Cacher la route" : "🗺️ Afficher la route";
    btn.style.cursor = "pointer";

    const select = L.DomUtil.create("select", "", container);
    select.innerHTML = `
      <option value="foot">🚶 Marche</option>
      <option value="driving">🚗 Voiture</option>
    `;
    select.value = routeMode;

    L.DomEvent.disableClickPropagation(container);

    btn.onclick = toggleRoute;
    select.onchange = (e) => setRouteMode(e.target.value);

    const Control = L.Control.extend({
      options: { position: "topright" },
      onAdd: () => container
    });

    const control = new Control();
    map.addControl(control);

    return () => map.removeControl(control);
  }, [map, showRoute, routeMode]);

  return null;
}
