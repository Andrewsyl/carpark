export const LIGHT_MAP_STYLE = [
  {
    elementType: "geometry",
    stylers: [{ lightness: 10 }, { saturation: 0 }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#2f3a45" }],
  },
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];
