"use strict";
(() => {
  // src/content/netflix-main.js
  (function() {
    "use strict";
    const getReactFiber = (root) => {
      if (!root)
        return null;
      const key = Object.keys(root).find((k) => k.startsWith("__reactFiber"));
      return key ? root[key] : null;
    };
    const getReactInternals = (root) => {
      if (!root)
        return null;
      const key = Object.keys(root).find((k) => k.startsWith("__reactInternalInstance"));
      return key ? root[key] : null;
    };
    const getWrapperStateNode = () => {
      const el = document.querySelector(".watch-video");
      if (!el)
        return null;
      const fiber = getReactFiber(el);
      return fiber ? fiber.return.return.return.return.stateNode : null;
    };
    const getVideoPlayer = () => {
      const vp = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
      const ids = vp.getAllPlayerSessionIds();
      const id = ids.find((v) => v.includes("watch"));
      return vp.getVideoPlayerBySessionId(id);
    };
    const getPlayerApi = () => {
      try {
        const fiber = getReactFiber(document.querySelector(".watch-video"));
        return fiber.return.return.return.return.return.stateNode || fiber.return.return.return.return.stateNode;
      } catch {
        return void 0;
      }
    };
    const isMovie = () => {
      try {
        return getWrapperStateNode().state.playableData.summary.type === "movie";
      } catch {
        return false;
      }
    };
    const getActionsState = () => ({
      nextEpisodeReady: !!document.querySelector("[data-uia='next-episode-seamless-button']")
    });
    const getAdState = () => {
      try {
        const currentAdBreak = getPlayerApi().state.playbackState.currentAdBreak;
        if (currentAdBreak != null) {
          return { watchingAds: true, adDurationLeft: currentAdBreak.progress.adBreakOffset.ms };
        }
        return { watchingAds: false, adDurationLeft: 0 };
      } catch {
        return { watchingAds: false, adDurationLeft: 0 };
      }
    };
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const getPlayerWrapper = () => {
      const selectors = [
        'div[data-uia="player"]',
        "div[data-videoid]",
        ".watch-video--player-view"
      ];
      for (const s of selectors) {
        try {
          const el = document.querySelector(s);
          if (el)
            return el;
        } catch {
        }
      }
      return null;
    };
    const showControlsAsync = async () => {
      const wrapper = getPlayerWrapper();
      if (!wrapper)
        return;
      const reactInstance = getReactInternals(wrapper);
      if (reactInstance) {
        reactInstance.memoizedProps.onPointerMoveCapture?.({
          stopPropagation: () => {
          },
          preventDefault: () => {
          }
        });
        await delay(2);
      }
    };
    const changeEpisodeFallback = async (id) => {
      try {
        const api = getPlayerApi();
        api.handleSelectorEpisodePlay({ stopPropagation: () => {
        } }, id);
      } catch (e) {
        console.log(e);
      }
    };
    const getEpisodeInformation = () => ({
      title: getWrapperStateNode().state.activeVideoMetadata._video.title,
      episodeNum: getWrapperStateNode().state.activeVideoMetadata._video.seq,
      seasonNum: getWrapperStateNode().state.activeVideoMetadata._season._season.seq
    });
    const tryDisablePostPlay = () => {
      if (!isMovie())
        return;
      const node = getWrapperStateNode();
      if (node) {
        window.oldHasPostPlay = node.hasPostPlay;
        node.hasPostPlay = () => false;
      }
    };
    const teardownFixPostPlay = () => {
      const node = getWrapperStateNode();
      if (node && window.oldHasPostPlay)
        node.hasPostPlay = window.oldHasPostPlay;
    };
    const seekInteraction = (e) => {
      try {
        if (e.source !== window)
          return;
        const { type, time, videoId } = e.data || {};
        if (!type)
          return;
        const player = getVideoPlayer();
        if (type === "SEEK") {
          if (time >= player.duration) {
            player.pause();
            player.seek(player.duration - 100);
          } else {
            player.seek(time - 100);
          }
        } else if (type === "PLAY") {
          player.play();
        } else if (type === "PAUSE") {
          player.pause();
        } else if (type === "FIX_POST_PLAY") {
          tryDisablePostPlay();
        } else if (type === "IsPaused") {
          window.dispatchEvent(new CustomEvent("FromNode", {
            detail: { type: "IsPaused", paused: player.isPaused(), updatedAt: Date.now() }
          }));
        } else if (type === "GetCurrentTime") {
          const t = player.getSegmentTime?.() ?? player.getCurrentTime();
          window.dispatchEvent(new CustomEvent("FromNode", {
            detail: { type: "CurrentTime", time: t, updatedAt: Date.now() }
          }));
        } else if (type === "GetState") {
          if (player) {
            const t = player.getSegmentTime?.() ?? player.getCurrentTime();
            window.dispatchEvent(new CustomEvent("FromNode", {
              detail: {
                type: "UpdateState",
                time: t,
                paused: player.isPaused(),
                loading: player.getBusy() !== null,
                adState: getAdState(),
                actionsState: getActionsState(),
                updatedAt: Date.now()
              }
            }));
          }
        } else if (type === "ShowControls") {
          showControlsAsync();
        } else if (type === "NEXT_EPISODE") {
          changeEpisodeFallback(videoId);
        } else if (type === "GetEpisodeData") {
          try {
            window.dispatchEvent(new CustomEvent("FromNode", {
              detail: { type: "GetEpData", episodeData: getEpisodeInformation(), updatedAt: Date.now() }
            }));
          } catch {
          }
        } else if (type === "teardown") {
          teardownFixPostPlay();
          window.removeEventListener("message", seekInteraction, false);
          window.injectScriptLoaded = false;
        }
      } catch (err) {
        console.log(err);
      }
    };
    if (!window.injectScriptLoaded) {
      window.injectScriptLoaded = true;
      window.addEventListener("message", seekInteraction, false);
      console.log("Hiranda: Netflix injected script loaded");
    }
  })();
})();
