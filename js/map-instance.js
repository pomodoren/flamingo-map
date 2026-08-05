import { mapElement, statusFilters } from "./dom-refs.js";
import { selectedValues } from "./dom-helpers.js";
import { getMarkerStyle } from "./marker-style.js";

/*
 * The OpenLayers map itself: the vector source cities are loaded into,
 * the base tile layer, and the marker layer (styled via marker-style.js).
 */

export const source = new ol.source.Vector();

export const locationLayer = new ol.layer.Vector({
  source,
  style: feature =>
    getMarkerStyle(feature, selectedValues(statusFilters)),
});

const baseMapLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

    attributions:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',

    crossOrigin: "anonymous",
    maxZoom: 19,
  }),
});

export const map = new ol.Map({
  target: mapElement,

  layers: [
    baseMapLayer,
    locationLayer,
  ],

  view: new ol.View({
    center: ol.proj.fromLonLat([
      14.5,
      45.5,
    ]),

    zoom: 4,
    minZoom: 2,
    maxZoom: 19,
  }),
});
