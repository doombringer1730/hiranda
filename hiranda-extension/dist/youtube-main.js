"use strict";
(() => {
  // src/content/youtube-main.js
  (function() {
    "use strict";
    let resizeVisible = false;
    const isPlayerPage = () => window.location.href.includes("/watch") || window.location.href.includes("/shorts/");
    const getVideoElement = () => {
      const href = window.location.href;
      if (!isPlayerPage())
        return null;
      if (href.includes("/watch"))
        return document.querySelector("#movie_player");
      if (href.includes("/shorts/"))
        return document.querySelector("#shorts-player");
      return null;
    };
    const setTheater = () => {
      const theaterButton = document.querySelector(".ytp-size-button");
      if (theaterButton) {
        const inTheater = document.querySelector("ytd-watch-flexy[theater]");
        if (!inTheater)
          theaterButton.click();
        theaterButton.style.display = "none";
      }
    };
    const disableTheater = () => {
      const theaterButton = document.querySelector(".ytp-size-button");
      if (theaterButton)
        theaterButton.style.display = "";
    };
    function resizeYoutube(ytPlayer) {
      const video = document.querySelector("#movie_player");
      Object.getOwnPropertyNames(ytPlayer).forEach((prop) => {
        const obj = ytPlayer[prop];
        if (obj && obj.toString() === "function(a,b){this.width=a;this.height=b}") {
          const oldObj = obj;
          window._yt_player[prop] = function(a, b) {
            if (video && video.isFullscreen && video.isFullscreen() && resizeVisible) {
              const adjustSize = 14;
              const aspectRatio = b / a;
              a = a - (304 + adjustSize);
              b = aspectRatio * a;
            }
            return new oldObj(a, b);
          };
          window._yt_player[prop].prototype = oldObj.prototype;
          window.resizeScriptReady = true;
        }
      });
    }
    if (!window.videoIdScriptLoaded) {
      window.videoIdScriptLoaded = true;
      window.resizeScriptReady = false;
      window.addEventListener("YoutubeVideoMessage", (event) => {
        if (!event.detail)
          return;
        const { type } = event.detail;
        const video = getVideoElement();
        if (type === "pauseVideo") {
          if (!window.resizeScriptReady && window._yt_player)
            resizeYoutube(window._yt_player);
          video?.pauseVideo();
        } else if (type === "playVideo") {
          if (!window.resizeScriptReady && window._yt_player)
            resizeYoutube(window._yt_player);
          video?.playVideo();
        } else if (type === "seekTo") {
          if (video)
            video.seekTo(event.detail.seekTo, true);
        } else if (type === "getVideoTime") {
          if (video) {
            const videoTime = video.getCurrentTime();
            window.dispatchEvent(new CustomEvent("FromNode", {
              detail: { type: "VideoTime", videoTime }
            }));
          }
        } else if (type === "getPlayerState") {
          if (video) {
            const t = video.getCurrentTime() ?? 0;
            const paused = video.getPlayerState?.() !== 1;
            window.dispatchEvent(new CustomEvent("FromNode", {
              detail: { type: "PlayerState", time: t * 1e3, paused, updatedAt: Date.now() }
            }));
          }
        } else if (type === "getVideoId") {
          const videoData = video?.getVideoData();
          if (videoData?.video_id) {
            window.dispatchEvent(new CustomEvent("FromNode", {
              detail: { type: "VideoId", videoId: videoData.video_id, isLive: !!videoData.isLive }
            }));
          }
        } else if (type === "getVideoTitle") {
          const title = video?.getVideoData()?.title;
          if (title) {
            window.dispatchEvent(new CustomEvent("FromNode", {
              detail: { type: "VideoTitle", title }
            }));
          }
        } else if (type === "setTheater") {
          setTheater();
        } else if (type === "disableTheater") {
          disableTheater();
        } else if (type === "SetChatVisible") {
          resizeVisible = event.detail.visible;
          if (video) {
            try {
              video.setSize();
            } catch {
            }
            try {
              video.setInternalSize();
            } catch {
            }
          }
        } else if (type === "jumpToNextEpisode") {
          const urlPath = `/watch?v=${event.detail.nextVideoId}`;
          const navigationData = {
            endpoint: {
              commandMetadata: {
                webCommandMetadata: {
                  url: urlPath,
                  rootVe: 3832,
                  webPageType: "WEB_PAGE_TYPE_WATCH"
                },
                watchEndpoint: { videoId: event.detail.nextVideoId, nofollow: true }
              }
            }
          };
          const ytNav = document.querySelector("ytd-app");
          if (ytNav) {
            ytNav.fire("yt-navigate", navigationData);
            window.dispatchEvent(new CustomEvent("FromNode", { detail: { type: "Navigated" } }));
          }
        }
      });
      document.addEventListener("yt-navigate-finish", () => {
        window.dispatchEvent(new CustomEvent("FromNode", {
          detail: { type: "SpaNavigated", href: window.location.href }
        }));
      });
      console.log("Hiranda: YouTube injected script loaded");
    }
  })();
})();
