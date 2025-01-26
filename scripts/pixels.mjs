import PixelsManager from "./manager.mjs";
import PixelsConfiguration from "./apps/pixels-config.mjs";
import * as api from "./handlers.mjs";

/* -------------------------------------------- */
/*  Client Initialization                       */
/* -------------------------------------------- */

let reconnectInterval;

Hooks.on("init", function () {

  // Pixels enabled
  game.settings.register("pixels", "enabled", {
    scope: "client",
    name: "PIXELS.SETTINGS.ENABLED.Name",
    hint: "PIXELS.SETTINGS.ENABLED.Hint",
    config: true,
    type: Boolean,
    default: false,
    onChange: enabled => {
      module.enabled = enabled;
      _initialize(enabled);
      canvas?.draw();
    }
  });

  // Unprompted rolls
  game.settings.register("pixels", "allowUnprompted", {
    scope: "client",
    name: "PIXELS.SETTINGS.UNPROMPTED.Name",
    hint: "PIXELS.SETTINGS.UNPROMPTED.Hint",
    config: true,
    type: Boolean,
    default: true
  });

  // Remember connected devices
  game.settings.register("pixels", "devices", {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });

  // Enable button in scene controls
  game.settings.register("pixels", "enableSceneControls", {
    scope: "client",
    name: "PIXELS.SETTINGS.ENABLE_SCENE_CONTROLS.Name",
    hint: "PIXELS.SETTINGS.ENABLE_SCENE_CONTROLS.Hint",
    config: true,
    type: Boolean,
    default: true,
    onChange: enabled => {
      canvas?.draw();
    }
  });

  // Heartbeat interval
  game.settings.register("pixels", "heartBeatInterval", {
    scope: "client",
    name: "PIXELS.SETTINGS.HEARTBEAT.Name",
    hint: "PIXELS.SETTINGS.HEARTBEAT.Hint",
    config: true,
    type: Number,
    default: 0,
    range: {
      min: 0,
      max: 60,
      step: 1
    },
    onChange: heartBeatInterval => {
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
      }
      if (heartBeatInterval > 0) {
        reconnectInterval = setInterval(async () => {
          await api.reconnectPixels();
        }, heartBeatInterval * 60000);
      }
    }
  });

  // Configuration menu
  game.settings.registerMenu("pixels", "configuration", {
    name: "PIXELS.SETTINGS.CONFIG.Name",
    label: "PIXELS.SETTINGS.CONFIG.Label",
    icon: "fa-solid fa-dice-d20",
    type: PixelsConfiguration,
    restricted: false
  });

  // Core Dice Configuration
  CONFIG.Dice.fulfillment.methods.pixels = {label: "Pixels - Electronic Dice", interactive: true};

  // Register module properties
  const module = globalThis.pixelsDice = game.modules.get("pixels");
  module.enabled = false;
  module.PIXELS = PixelsManager.fromSetting();
  module.api = api;
  module.debounceRoll = foundry.utils.debounce(api.completePendingRoll, 1000);
});

/* -------------------------------------------- */
/*  Add Pixels Control Button                   */
/* -------------------------------------------- */

Hooks.on('getSceneControlButtons', (controls) => {
  if (!canvas) return;

  CONFIG.Canvas.layers.pixelsConfig = {layerClass: InteractionLayer, group: "interface"};

  controls.push({
    name: 'pixelsControl',
    title: 'PIXELS.SCENE_CONTROL.CONTROL.Title',
    layer: 'pixelsConfig',
    icon: 'pixels-dice-icon', // Font-Awesome alternatives: 'fa-brands fa-connectdevelop' or 'fa-sharp-duotone fa-thin fa-dice-d20',
    visible: game.settings.get("pixels", "enabled") && game.settings.get("pixels", "enableSceneControls"),
    tools: [
      {
        name: 'pixelConfig',
        title: 'PIXELS.SCENE_CONTROL.TOOL_CONFIG.Title',
        icon: 'fa-regular fa-bluetooth',
        visible: true,
        button: true,
        onClick: () => {
          api.openPixelsConfiguration();
        }
      },
      {
        name: 'pixelReconnect',
        title: 'PIXELS.SCENE_CONTROL.TOOL_RECONNECT.Title',
        icon: 'fas fa-refresh',
        visible: true,
        button: true,
        onClick: async () => {
          if (pixelsDice.PIXELS.size <= 0) {
            return ui.notifications.warn(game.i18n.localize('PIXELS.SCENE_CONTROL.TOOL_RECONNECT.Notifications.NoDevices'));
          }

          if (await api.reconnectPixels() === true)
            ui.notifications.info(pixelsDice.PIXELS.size + game.i18n.localize('PIXELS.SCENE_CONTROL.TOOL_RECONNECT.Notifications.Reconnect'));
          else
            ui.notifications.warn(game.i18n.localize('PIXELS.SCENE_CONTROL.TOOL_RECONNECT.Notifications.Failure'));
        }
      }
    ],
    activeTool: 'pixelConfig'
  });
});

/* -------------------------------------------- */
/*  Client Ready                                */
/* -------------------------------------------- */

Hooks.on("ready", function () {
  const enabled = pixelsDice.enabled = game.settings.get("pixels", "enabled");
  return _initialize(enabled);
});

/* -------------------------------------------- */

async function _initialize(enabled) {
  // Automatic connection to available dice
  if (!enabled) return;

  const reconnectSuccess = await pixelsDice.PIXELS.tryReconnect();

  if (!reconnectSuccess) {
    ui.notifications.warn("PIXELS.ERRORS.ReconnectFailed", {localize: true});
    const app = new PixelsConfiguration(pixelsDice.PIXELS);
    app.render(true);
  }

  // Schedule the reconnectPixels function to run every x minutes based on client settings
  const heartBeatInterval = game.settings.get("pixels", "heartBeatInterval");
  if (heartBeatInterval > 0) {
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
    }
    if (heartBeatInterval > 0) {
      reconnectInterval = setInterval(async () => {
        await api.reconnectPixels();
      }, heartBeatInterval * 60000);
    }
  }
}
