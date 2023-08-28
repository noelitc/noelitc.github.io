/**
Copyright 2022 Google LLC. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


'use strict';

import { CastQueue } from './queuing.js';
import { MediaFetcher } from './media_fetcher.js';
import { AdsTracker, SenderTracker, ContentTracker } from './cast_analytics.js';

/**
 * @fileoverview This sample demonstrates how to build your own Web Receiver for
 * use with Google Cast. The main receiver implementation is provided in this
 * file which sets up access to the CastReceiverContext and PlayerManager. Some
 * added functionality can be enabled by uncommenting some of the code blocks
 * below.
 */


/*
 * Convenience variables to access the CastReceiverContext and PlayerManager.
 */
const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

/*
 * Constant to be used for fetching media by entity from sample repository.
 */
const ID_REGEX = '\/?([^\/]+)\/?$';

/**
 * Debug Logger
 */
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
const LOG_RECEIVER_TAG = 'Receiver';

/*
 * WARNING: Make sure to turn off debug logger for production release as it
 * may expose details of your app.
 * Uncomment below line to enable debug logger, show a 'DEBUG MODE' tag at
 * top left corner and show debug overlay.
 */
 context.addEventListener(cast.framework.system.EventType.READY, () => {
  // if (!castDebugLogger.debugOverlayElement_) {
  //   /**
  //    *  Enable debug logger and show a 'DEBUG MODE' tag at
  //    *  top left corner.
  //    */
  //     castDebugLogger.setEnabled(true);

  //   /**
  //    * Show debug overlay.
  //    */
  //     castDebugLogger.showDebugLogs(true);
  // }
});

/*
 * Set verbosity level for Core events.
 */
castDebugLogger.loggerLevelByEvents = {
  'cast.framework.events.category.CORE':
    cast.framework.LoggerLevel.INFO,
  'cast.framework.events.EventType.MEDIA_STATUS':
    cast.framework.LoggerLevel.DEBUG
};

if (!castDebugLogger.loggerLevelByTags) {
  castDebugLogger.loggerLevelByTags = {};
}

/*
 * Set verbosity level for custom tag.
 * Enables log messages for error, warn, info and debug.
 */
castDebugLogger.loggerLevelByTags[LOG_RECEIVER_TAG] =
  cast.framework.LoggerLevel.DEBUG;

/*
 * Example of how to listen for events on playerManager.
 */
playerManager.addEventListener(
  cast.framework.events.EventType.ERROR, (event) => {
    castDebugLogger.error(LOG_RECEIVER_TAG,
      'Detailed Error Code - ' + event.detailedErrorCode);
    if (event && event.detailedErrorCode == 905) {
      castDebugLogger.error(LOG_RECEIVER_TAG,
        'LOAD_FAILED: Verify the load request is set up ' +
        'properly and the media is able to play.');
    }
});

/*
 * Example analytics tracking implementation. To enable this functionality see
 * the implmentation and complete the TODO item in ./google_analytics.js. Once
 * complete uncomment the the calls to startTracking below to enable each
 * Tracker.
 */
const adTracker = new AdsTracker();
const senderTracker = new SenderTracker();
const contentTracker = new ContentTracker();
// adTracker.startTracking();
// senderTracker.startTracking();
// contentTracker.startTracking();

/**
 * Modifies the provided mediaInformation by adding a pre-roll break clip to it.
 * @param {cast.framework.messages.MediaInformation} mediaInformation The target
 * MediaInformation to be modified.
 * @return {Promise} An empty promise.
 */
function addBreaks(mediaInformation) {
  castDebugLogger.debug(LOG_RECEIVER_TAG, "addBreaks: " +
    JSON.stringify(mediaInformation));
  return MediaFetcher.fetchMediaById('fbb_ad')
  .then((clip1) => {
    mediaInformation.breakClips = [
      {
        id: 'fbb_ad',
        title: clip1.title,
        contentUrl: clip1.stream.dash,
        contentType: 'application/dash+xml',
        whenSkippable: 5
      }
    ];

    mediaInformation.breaks = [
      {
        id: 'pre-roll',
        breakClipIds: ['fbb_ad'],
        position: 0
      }
    ];
  });
}

/*
 * Intercept the LOAD request to load and set the contentUrl.
 */
playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.LOAD, loadRequestData => {
    castDebugLogger.debug(LOG_RECEIVER_TAG,
      `loadRequestData: ${JSON.stringify(loadRequestData)}`);

    // If the loadRequestData is incomplete, return an error message.
    if (!loadRequestData || !loadRequestData.media) {
      const error = new cast.framework.messages.ErrorData(
        cast.framework.messages.ErrorType.LOAD_FAILED);
      error.reason = cast.framework.messages.ErrorReason.INVALID_REQUEST;
      return error;
    }

    // Check all content source fields for the asset URL or ID.
    let source = loadRequestData.media.contentUrl
      || loadRequestData.media.entity || loadRequestData.media.contentId;

    // If there is no source or a malformed ID then return an error.
    if (!source || source == "" || !source.match(ID_REGEX)) {
      let error = new cast.framework.messages.ErrorData(
        cast.framework.messages.ErrorType.LOAD_FAILED);
      error.reason = cast.framework.messages.ErrorReason.INVALID_REQUEST;
      return error;
    }

    let sourceId = source.match(ID_REGEX)[1];

    // Optionally add breaks to the media information and set the contentUrl.
    return Promise.resolve()
    // .then(() => addBreaks(loadRequestData.media)) // Uncomment to enable ads.
    .then(() => {
      // If the source is a url that points to an asset don't fetch from the
      // content repository.
      if (sourceId.includes('.')) {
        castDebugLogger.debug(LOG_RECEIVER_TAG,
          "Interceptor received full URL");
        loadRequestData.media.contentUrl = source;
        return loadRequestData;
      } else {
        // Fetch the contentUrl if provided an ID or entity URL.
        castDebugLogger.debug(LOG_RECEIVER_TAG, "Interceptor received ID");
        return MediaFetcher.fetchMediaInformationById(sourceId)
        .then((mediaInformation) => {
          loadRequestData.media = mediaInformation;
          return loadRequestData;
        })
      }
    })
    .catch((errorMessage) => {
      let error = new cast.framework.messages.ErrorData(
        cast.framework.messages.ErrorType.LOAD_FAILED);
      error.reason = cast.framework.messages.ErrorReason.INVALID_REQUEST;
      castDebugLogger.error(LOG_RECEIVER_TAG, errorMessage);
      return error;
    });
  }
);


/*
 * Set the control buttons in the UI controls.
 */
const controls = cast.framework.ui.Controls.getInstance();
controls.clearDefaultSlotAssignments();

// Assign buttons to control slots.
controls.assignButton(
  cast.framework.ui.ControlsSlot.SLOT_SECONDARY_1,
  cast.framework.ui.ControlsButton.QUEUE_PREV
);
controls.assignButton(
  cast.framework.ui.ControlsSlot.SLOT_PRIMARY_1,
  cast.framework.ui.ControlsButton.CAPTIONS
);
controls.assignButton(
  cast.framework.ui.ControlsSlot.SLOT_PRIMARY_2,
  cast.framework.ui.ControlsButton.SEEK_FORWARD_15
);
controls.assignButton(
  cast.framework.ui.ControlsSlot.SLOT_SECONDARY_2,
  cast.framework.ui.ControlsButton.QUEUE_NEXT
);

const CHANNEL = 'urn:x-cast:cast.unity.demo';

context.addCustomMessageListener(CHANNEL, onMessageReceived);
document.getElementById('message').innerHTML ="testing";
context.start();
/*const canvas = document.getElementById('mycanvas');
 let bitmapFontText;

            const app = new PIXI.Application({
                view: canvas,
                width: window.innerWidth, 
                height: window.innerHeight
            });

            console.log(PIXI.utils.TextureCache);

            let loader = PIXI.Loader.shared;

            loader.add("guy", "guy.json");
            loader.add("bg", "sprite2.png");
            loader.onProgress.add(handleLoadProgress);
            loader.onLoad.add(handleLoadAsset);
            loader.onError.add(handleLoadError);
            loader.load(handleLoadComplete);
          //  PIXI.sound.Sound.from({
         //   url: 'bears_birthday_party.mp3',
         //   autoPlay: true,
         //   complete: function() {
         //   console.log('Sound finished');
       // }
         //   });
            let img;

            function handleLoadProgress(loader, resource) {
                console.log(loader.progress + "% loaded");
            }

            function handleLoadAsset(loader, resource) {
                console.log("asset loaded " + resource.name);
            }

            function handleLoadError() {
                console.error("load error");
            }

            function handleLoadComplete() {
                let texture = loader.resources.guy.spritesheet;
                img = new PIXI.AnimatedSprite(texture.animations.pixels_large);
                img.anchor.x = 0.5;
                img.anchor.y = 0.5;
                app.stage.addChild(img);

                img.animationSpeed = 0.1;
                img.play();

                img.onLoop = () => {
                    console.log('loop');
                }
                img.onFrameChange = () => {
                    console.log('currentFrame', img.currentFrame);
                }
                img.onComplete = () => {
                    console.log('done');
                }
                const style = new PIXI.TextStyle({
                                fontFamily: 'Arial',
                                fontSize: 36,
                                fontStyle: 'italic',
                                fontWeight: 'bold',
                                fill: ['#ffffff', '#00ff99'], // gradient
                                stroke: '#4a1850',
                                strokeThickness: 5,
                                dropShadow: true,
                                dropShadowColor: '#000000',
                                dropShadowBlur: 4,
                                dropShadowAngle: Math.PI / 6,
                                dropShadowDistance: 6,
                                wordWrap: true,
                                wordWrapWidth: 440,
                                lineJoin: 'round',
                            });
                let richText = new PIXI.Text('Welcome to ElfMonn', style);
                richText.x = 50;
                richText.y = 220;
                
                const bitstyle = new PIXI.TextStyle();
                PIXI.BitmapFont.from("foo", bitstyle);

// Apply the font to our text
    bitmapFontText = new PIXI.BitmapText("Hello World", { fontName: "foo" });
    bitmapFontText.x = 50;
    bitmapFontText.y = 100;
                bitstyle.fill = 'red';
PIXI.BitmapFont.from("foo", bitstyle);
bitmapFontText.text="Waiting....";
// Update text
bitmapFontText.updateText();

    app.stage.addChild(bitmapFontText);


                app.stage.addChild(richText);

               
                     app.ticker.add(animate);
            
                }
            function animate() {
                img.x = app.renderer.screen.width / 2;
                img.y = app.renderer.screen.height / 2;
            }
            */
            var CopiedImageString="";
var CopiedSoundString="";
var lastEventData;
var ImageCounter=0;
var totalAudio=0;
function onMessageReceived(customEvent) {
  document.getElementById('cast-media-player').setAttribute("data-content", `${customEvent.data.message}`);
   lastEventData = customEvent.data;
       if ( document.getElementById('message').innerHTML  == "waiting")
       {
           return;
       }
     document.getElementById('message').innerHTML =  CopiedImageString.length ;//.message;
 // document.getElementById('message').innerHTML = customEvent.data;//.message;
 // bitmapFontText.text = customEvent.data.message;
      if (customEvent.data.description == "ImageIndex")
    {
          unityGame.SendMessage("ImageHandler", "SetPageIndex", customEvent.data.message);
         document.getElementById('response').innerHTML = "Setpage" + customEvent.data.message;
          CopiedImageString="";
            return;
    }
     if (customEvent.data.description == "SoundIndex")
    {
          unityGame.SendMessage("ImageHandler", "SetSoundIndex", customEvent.data.message);
         document.getElementById('response').innerHTML = "Setpage" + customEvent.data.message;
          CopiedSoundString="";
            return;
    }
    if (customEvent.data.description == "startTask")
    {
          unityGame.SendMessage("GameManager", "StartTask", customEvent.data.message);
            return;
    }
      if (customEvent.data.description == "startIntro")
    {
          unityGame.SendMessage("GameManager", "StartInto", customEvent.data.message);
            return;
    }
     if (customEvent.data.description == "SetName")
    {
          unityGame.SendMessage("GameManager", "SetName", customEvent.data.message);
        return;
    }
    if (customEvent.data.description == "audio")
    {
        if (customEvent.data.num == -1)
        {
             if ( document.getElementById('message').innerHTML  != "waiting")
                {
                    unityGame.SendMessage("ImageHandler", "HandleSoundDataPart", CopiedSoundString);
                }
              totalAudio+=CopiedSoundString.length;
              document.getElementById('message').innerHTML = "last " + CopiedSoundString.length + " "  + totalAudio ;
                CopiedSoundString="";
        
           
            
            if ( document.getElementById('message').innerHTML  != "waiting")
            {
                unityGame.SendMessage("ImageHandler", "HandleSoundData", CopiedSoundString);
            }
          
        }
        else if (customEvent.data.num == 0)
        {
            CopiedSoundString = "";
            CopiedSoundString += customEvent.data.message;
              if (CopiedSoundString.length < 1000 )
            {
                 if ( document.getElementById('message').innerHTML  != "waiting")
                {
                    unityGame.SendMessage("ImageHandler", "HandleSoundDataPart", CopiedSoundString);
                }
                CopiedSoundString="";
                if ( document.getElementById('message').innerHTML  != "waiting")
                {
                    unityGame.SendMessage("ImageHandler", "HandleSoundData", CopiedSoundString);
                }
                CopiedSoundString="";
            }
        }
        else 
        {
            CopiedSoundString += customEvent.data.message;
 
            if (CopiedSoundString.length > 5000 )
            {
                if ( document.getElementById('message').innerHTML  != "waiting")
                {
                    totalAudio+=CopiedSoundString.length;
                     document.getElementById('message').innerHTML = "" + CopiedSoundString.length + " "  + totalAudio ;
                    unityGame.SendMessage("ImageHandler", "HandleSoundDataPart", CopiedSoundString);
                }
                CopiedSoundString="";
            }
            
        }
        return;
    }
    if (customEvent.data.num == -1)
        {
             if ( document.getElementById('message').innerHTML  != "waiting")
                {
                    unityGame.SendMessage("ImageHandler", "HandleImageDataPart", CopiedImageString);
                }
                CopiedImageString="";
        
             document.getElementById('message').innerHTML = "last "  ;
            //unityGame.SendMessage("ImageHandler", "HandleWholeImage", CopiedImageString);
            if ( document.getElementById('message').innerHTML  != "waiting")
            {
                unityGame.SendMessage("ImageHandler", "HandleImageData", CopiedImageString);
            }
          
        }
        else if (customEvent.data.num == 0)
        {
            CopiedImageString = "";
            CopiedImageString += customEvent.data.message;
           if (CopiedImageString.length < 1000 )
            {
                 if ( document.getElementById('message').innerHTML  != "waiting")
                {
                    unityGame.SendMessage("ImageHandler", "HandleImageDataPart", CopiedImageString);
                }
                CopiedImageString="";
                if ( document.getElementById('message').innerHTML  != "waiting")
                {
                    unityGame.SendMessage("ImageHandler", "HandleImageData", CopiedImageString);
                }
                CopiedImageString="";
            }
        }
        else 
        {
            CopiedImageString += customEvent.data.message;
 
            if (CopiedImageString.length > 5000 )
            {
                if ( document.getElementById('message').innerHTML  != "waiting")
                {
                    unityGame.SendMessage("ImageHandler", "HandleImageDataPart", CopiedImageString);
                }
                CopiedImageString="";
            }
            
        }
    bitmapFontText.text = JSON.stringify(customEvent.data);
    
  //unityGame.SendMessage("ImageHandler", "HandleWholeImage", customEvent.data);
  castDebugLogger.info(LOG_RECEIVER_TAG, `Message received. ${customEvent.data.message}`);
}
function JavaScriptFunction(response) {
     document.getElementById('response').innerHTML =  "ready ready" ;
    
}

