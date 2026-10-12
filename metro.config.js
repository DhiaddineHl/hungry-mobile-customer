const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = config.resolver;

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...config.resolver,
  assetExts: assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...sourceExts, 'svg'],
};

// Opt-in browser preview for visual QA (HUNGRY_WEB_PREVIEW=1 npx expo start --web):
// native-only modules (maps, notifications) are swapped for web stand-ins.
if (process.env.HUNGRY_WEB_PREVIEW) {
  const path = require('path');
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && (moduleName === 'react-native-maps' || moduleName === 'expo-notifications')) {
      return { type: 'sourceFile', filePath: path.resolve(__dirname, `scripts/web-preview/${moduleName}.js`) };
    }
    return upstream ? upstream(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
