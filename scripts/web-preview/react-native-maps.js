// Web-preview stand-in for react-native-maps (native only). Used solely when
// metro runs with HUNGRY_WEB_PREVIEW=1, to render screens in a browser for
// visual QA against the design board. Draws a flat map-coloured box.
const React = require('react');
const { View } = require('react-native');

const MapView = React.forwardRef(function MapView({ style, children }, ref) {
  React.useImperativeHandle(ref, () => ({
    animateToRegion() {},
    animateCamera() {},
    fitToCoordinates() {},
    getCamera: async () => ({ center: { latitude: 35.8351, longitude: 10.5942 } }),
  }));
  return React.createElement(View, { style: [{ backgroundColor: '#DDE3EA', overflow: 'hidden' }, style] }, children);
});
const Noop = ({ children }) => (children ? React.createElement(View, null, children) : null);

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = Noop;
module.exports.Polyline = Noop;
module.exports.Circle = Noop;
module.exports.Callout = Noop;
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.PROVIDER_DEFAULT = undefined;
