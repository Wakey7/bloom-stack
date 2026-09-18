module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "BloomStack",
    ignore: [
      /^\/(?:\.git|\.github)(?:\/|$)/,
      /^\/(?:assets|docs|scripts|test)(?:\/|$)/,
      /^\/(?:out|coverage|\.cache|\.tmp|tmp)(?:\/|$)/,
      /^\/(?:AGENTS\.md|README\.md)$/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "bloom_stack",
        authors: "Bloom Stack Contributors",
        description: "以落块消除驱动冒险战斗的离线游戏。",
        setupExe: "BloomStackSetup.exe",
        noMsi: true,
      },
    },
  ],
};
