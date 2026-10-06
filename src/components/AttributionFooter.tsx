import styles from "./AttributionFooter.module.css";

export default function AttributionFooter() {
  return (
    <footer className={styles.footer}>
      <p>
        Data:{" "}
        <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer">
          USGS
        </a>{" "}
        ·{" "}
        <a href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer">
          NASA EONET
        </a>{" "}
        ·{" "}
        <a href="https://www.gdacs.org/" target="_blank" rel="noopener noreferrer">
          GDACS
        </a>
      </p>
      <p>
        Places:{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          © OpenStreetMap contributors
        </a>{" "}
        (Nominatim)
      </p>
      <p>
        Satellite tiles:{" "}
        <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">
          © Esri
        </a>{" "}
        · Maxar · Earthstar Geographics · USGS
      </p>
      <p>Country shapes: Natural Earth (public domain)</p>
      <p>
        Earth textures:{" "}
        <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">
          Solar System Scope
        </a>{" "}
        (CC BY 4.0), based on NASA Blue Marble / Black Marble
      </p>
    </footer>
  );
}
