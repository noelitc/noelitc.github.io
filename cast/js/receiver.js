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

window._setTimeout = window.setTimeout;
window.setTimeout = function(a, b) {
    // disable setTimeout so chromecast won't kill us after 5 minutes...
};
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

            var CopiedImageString="";
var CopiedSoundString="";
var lastEventData;
var ImageCounter=0;
var totalAudio=0;
var imageData = 'data:image/png;base64,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';

// You can also periodically reset the idle reason to keep the app active
function keepAlive() {
 // cast.framework.CastReceiverContext.getInstance().setIdleReason(null);
 // setTimeout(keepAlive, 60000); // Reset the idle reason every minute
}
keepAlive();
function onMessageReceived(customEvent) {
  document.getElementById('cast-media-player').setAttribute("data-content", `${customEvent.data.message}`);
   lastEventData = customEvent.data;
    
      if (customEvent.data.description == "tasks")
    {
        taskStarted=true;
        var taskObject = JSON.parse(customEvent.data.message);
         for  (var  i=0;i<taskObject.tasks.length;i++)
        {
            tasks[i] = taskObject.tasks[i];
        }
       
      return;
    }
      if (customEvent.data.num == -1)
        {
           
                CopiedImageString += customEvent.data.message;
               /*  const newBackgroundTexture = game.textures.addImage('newBackground', 'data:image/png;base64,' + CopiedImageString);
                  backgroundImage.setTexture('newBackground');
            const desiredWidth = window.innerWidth;

              // Calculate the new height while maintaining the aspect ratio
              const aspectRatio = backgroundImage.width / backgroundImage.height;
          const newHeight = desiredWidth / aspectRatio;

          // Set the new width and height
          backgroundImage.displayWidth = desiredWidth;
          backgroundImage.displayHeight = newHeight;*/

             game.textures.once('addtexture-brain', () =>
        {
            game.add.image(400, 300, 'brain');
        });

        game.textures.once('onerror', () =>
        {
            console.log('error decoding base64');
        });

        game.textures.once('onload', () =>
        {
            console.log('base64 image loaded');
        });
     game.textures.addBase64('brain', ImageData);
       // game.textures.addBase64('brain', CopiedImageString);
              return;
          
        }
        else if (customEvent.data.num == 0)
        {
            CopiedImageString = "";
            CopiedImageString += customEvent.data.message;
            return;
        
        }
        else 
        {
            CopiedImageString += customEvent.data.message;
 
          return;
            
        }
    return;
       if ( document.getElementById('message').innerHTML  == "waiting")
       {
           return;
       }
     document.getElementById('message').innerHTML =  CopiedImageString.length ;//.message;
 // document.getElementById('message').innerHTML = customEvent.data;//.message;
 // bitmapFontText.text = customEvent.data.message;
     if (customEvent.data.description == "Profile")
    {
          unityGame.SendMessage("ImageHandler", "SetProfileData", customEvent.data.message);
         document.getElementById('response').innerHTML = "Setpage" + customEvent.data.message;
          CopiedImageString="";
            return;
    }
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
    
  
      if (customEvent.data.description == "SoundURL")
    {
          unityGame.SendMessage("ImageHandler", "SetAudioURL", customEvent.data.message);
         document.getElementById('response').innerHTML = "Setpage" + customEvent.data.message;
          CopiedSoundString="";
            return;
    }
     if (customEvent.data.description == "TaskSoundIndex")
    {
          unityGame.SendMessage("ImageHandler", "SetTaskSoundIndex", customEvent.data.message);
         document.getElementById('response').innerHTML = "Setpage" + customEvent.data.message;
          CopiedSoundString="";
            return;
    }
     if (customEvent.data.description == "TaskSoundURL")
    {
          unityGame.SendMessage("ImageHandler", "SetTaskAudioURL", customEvent.data.message);
         document.getElementById('response').innerHTML = "Setpage" + customEvent.data.message;
          CopiedSoundString="";
            return;
    }
        if (customEvent.data.description == "TaskStringIndex")
    {
          unityGame.SendMessage("ImageHandler", "SetTaskStringIndex", customEvent.data.message);
         document.getElementById('response').innerHTML = "Setpage" + customEvent.data.message;
          CopiedSoundString="";
            return;
    }
   
     if (customEvent.data.description == "Task")
    {
         
          unityGame.SendMessage("ImageHandler", "SetTaskString", customEvent.data.message);
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
                      CopiedSoundString="";
                }
              
                if ( document.getElementById('message').innerHTML  != "waiting")
                {
                    unityGame.SendMessage("ImageHandler", "HandleSoundData", CopiedSoundString);
                     CopiedSoundString="";
                }
               
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
                     CopiedSoundString="";
                }
               
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

