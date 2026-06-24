module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Downcompile ES2022 private class fields/methods to closure-based form
      // so Hermes on older iOS/Android can parse them. Required for any
      // node_module that ships modern JS (e.g. xmldom, use-callback-ref).
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
    ],
  };
};
