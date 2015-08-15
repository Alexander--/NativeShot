// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
// Cu.import('resource://gre/modules/XPCOMUtils.jsm'); // frame scripts already have this loaded

// Globals
var core = {
	addon: {
		id: 'NativeShot@jetpack',
		path: {
			content_accessible: 'chrome://nativeshot-accessible/content/'
		}
	}
};
const gContentFrameMessageManager = this;
const clientId = new Date().getTime(); // server doesnt generate clientId in this framescript ecosystem
const TWITTER_HOSTNAME = 'twitter.com';
const TWITTER_IMAGE_SUBSTR = 'https://pbs.twimg.com/media/';
var TWITTER_IMAGE_SUBSTR_REGEX = /\.twimg\.com/i;
var gTweeted = false; // set to true on succesful tweet

// Lazy Imports
const myServices = {};

const serverMessageListener = {
	// listens to messages sent from clients (child framescripts) to me/server
	receiveMessage: function(aMsg) {
		console.error('CLIENT recieving msg:', 'this client id:', clientId, 'aMsg:', aMsg);
		switch (aMsg.json.aTopic) {
			/* // i dont have server telling us when to do init in this framescript ecosystem
			case 'serverRequest_clientInit':
					
					// server sends init after i send server clientBorn message
					fsComClient.init(aMsg.json.core);
					
				break;
			*/
			case 'serverRequest_clientShutdown':
			
					unregister();
			
				break;
			// start - devuser edit - add your personal message topics to listen to from server
			case 'serverCommand_attachImgDataURIWhenReady':
			
					serverCommand_attachImgDataURIWhenReady(aMsg.json.imgDataUri, aMsg.json.iIn_arrImgDataUris);
			
				break;
			case 'serverCommand_reOpenTweetModal':
			
					do_openTweetModal();
			
				break;
			// end - devuser edit - add your personal message topics to listen to from server
			default:
				console.error('CLIENT unrecognized aTopic:', aMsg.json.aTopic, 'aMsg:', aMsg);
		}
	}
};

function fsUnloaded(aEvent) {
	if (aEven.target == gContentFrameMessageManager) {
		// frame script unloaded, tab was closed
		// :todo: check if the tweet was submitted, if it wasnt, then notif parent to make the notification-bar button to a "open new tab and reattach"
		sendAsyncMessage(core.addon.id, {aTopic:'clientRequest_clientDying', clientId:clientId, tweeted:gTweeted});
	}
}

function register() {
	// i dont have server telling us when to do init in this framescript ecosystem
	addMessageListener(core.addon.id, serverMessageListener);
	
	addEventListener('unload', fsUnloaded, false);
	
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	if (aContentDocument.readyState.state == 'ready' && aContentWindow.location.hostname == TWITTER_HOSTNAME) {
		init();
	} else {
		console.error('adding listener for twitter load');
		addEventListener('DOMContentLoaded', listenForTwitterLoad, false); // add listener to listen to page loads  till it finds twitter page
	}
	
}

function unregister() {
	console.error('unregistering!!!!!');
	
	removeEventListener('unload', fsUnloaded, false);
	removeEventListener('DOMContentLoaded', listenForTwitterLoad, false);
	removeEventListener('DOMContentLoaded', listenForTwitterSignIn, false);
	
	try {
		removeMessageListener(core.addon.id, serverMessageListener);
	} catch(ignore) {
		console.info('failed to removeMessageListener probably because tab is already dead, ex:', ignore);
	}
	
	try {
		var aContentWindow = content;
		var aContentDocument = content.document;
	} catch (ignore) {} // content goes to null when tab is killed
	
	if (aContentWindow) {
		aContentWindow.removeEventListener('unload', listenForTwittterUnload, false);
		
		var myUnregScript = aContentDocument.createElement('script');
		myUnregScript.setAttribute('src', core.addon.path.content_accessible + 'twitter_unregister.js');
		myUnregScript.setAttribute('id', 'nativeshot_twitter_unregister');
		myUnregScript.setAttribute('nonce', aContentDocument.querySelector('script[nonce]').getAttribute('nonce'));
		aContentDocument.documentElement.appendChild(myUnregScript);
		
		aContentWindow.removeEventListener('nativeShot_notifyDialogClosed', on_nativeShot_notifyDialogClosed, false, true);
		aContentWindow.removeEventListener('nativeShot_notifyDataTweetSuccess', on_nativeShot_notifyDataTweetSuccess, false, true);
		aContentWindow.removeEventListener('nativeShot_notifyDataTweetError', on_nativeShot_notifyDataTweetError, false, true);
		
		if (waitForFocus_forAttach) {
			aContentWindow.removeEventListener('focus', waitForFocus_forAttach, false);
		}
	}
}

function listenForTwitterSignIn(aEvent) {
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	if (aContentWindow.frameElement) {
		//console.warn('frame element loaded, so dont respond yet');
	} else {
		if (aContentWindow.location.hostname == TWITTER_HOSTNAME) {
			var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button');
			if (!btnNewTweet) {
				console.warn('still not signed in yet');
			} else {
				// signed in now
				do_openTweetModal();
			}
		} else {
			console.warn('page done loading buts it not twitter, so keep listener attached, im waiting for twitter:', aContentWindow.location);
		}
	}
}

function on_nativeShot_notifyDataTweetError(aEvent) {
	// :todo: tell notification-bar that tweet was submited and failed
	var a = aEvent.detail.a;
	var b = aEvent.detail.b;
	
	console.error('tweet submission came back error, aEvent:', {aEvent: aEvent,a: a, b: b});
	
	var refDetails;
	if (b.tweetboxId) {
		refDetails = b;
	} else {
		refDetails = b.sourceEventData;
	}
}
function on_nativeShot_notifyDataTweetSuccess(aEvent) {
	// :todo: tell notification-bar that tweet was submited succesfully, and is now waiting to receive uploaded image urls
	var a = aEvent.detail.a;
	var b = aEvent.detail.b;
	
	console.error('tweet success baby, aEvent:', {aEvent: aEvent,a: a, b: b});
	
	var refDetails;
	if (b.tweetboxId) {
		refDetails = b;
	} else {
		refDetails = b.sourceEventData;
	}
	
	gTweeted = true;
	aContentWindow.removeEventListener('unload', listenForTwittterUnload, false);
	sendAsyncMessage(core.addon.id, {aTopic:'clientRequest_tweetSuccess', clientId:clientId});
}

function on_nativeShot_notifyDialogClosed(aEvent) {
	console.error('tweet dialog closed, aEvent:', aEvent);
	if (!gTweeted) {
		// :todo: tell notification-bar that tweet was lost due to closed tweet, offer on click to openTweetModal and reattach
		sendAsyncMessage(core.addon.id, {aTopic:'clientRequest_tweetClosedWithoutSubmit', clientId:clientId});
	}
}
	
function init() {
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	
	// :todo: absolutely ensure we are on home page, meaning users timeline, because when user submits tweet, if they are not on timeline, then the images are not loaded and i wont be able to get their uploaded image urls
	
	// test if signed in
	var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button');
	if (!btnNewTweet) {
		// assume not signed in
		// add listener listening to sign in
		addEventListener('DOMContentLoaded', listenForTwitterSignIn, false);
		sendAsyncMessage(core.addon.id, {aTopic:'clientRequest_twitterNotSignedIn', clientId:clientId});
		return;
	}
	
	var myRegScript = aContentDocument.createElement('script');
	myRegScript.setAttribute('src', core.addon.path.content_accessible + 'twitter_register.js');
	myRegScript.setAttribute('id', 'nativeshot_twitter_register');
	myRegScript.setAttribute('nonce', aContentDocument.querySelector('script[nonce]').getAttribute('nonce'));
	aContentDocument.documentElement.appendChild(myRegScript);
	
	aContentWindow.addEventListener('nativeShot_notifyDialogClosed', on_nativeShot_notifyDialogClosed, false, true);
	aContentWindow.addEventListener('nativeShot_notifyDataTweetSuccess', on_nativeShot_notifyDataTweetSuccess, false, true);
	aContentWindow.addEventListener('nativeShot_notifyDataTweetError', on_nativeShot_notifyDataTweetError, false, true);
	
	do_openTweetModal();

	// :todo: detect if user clicks on "x" of any of the previews, then that should be removed from notification-bar, to identify which one got x'ed i can identify by on attach, i wait till it gets attached right, so on attach get that upload id. maybe just addEventListener on those preview x's, it seems you cant tab to it, so this is good, just attach click listeners to it
	
	aContentWindow.addEventListener('unload', listenForTwittterUnload, false);
}

// START - custom functionalities
function listenForTwittterUnload(aEvent) {
	// :todo: notify notification-bar that tweet was lost due to unload, offer on click to load twitter.com again, its important that tweet happens from twitter.com as when the tweet goes through the images show up in the timeline and i can get those
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	if (aContentWindow.frameElement) {
		//console.warn('frame element loaded, so dont respond yet');
	} else {
		if (!gTweeted) {
			if (aContentWindow.location.hostname != TWITTER_HOSTNAME) {
				// twitter unloaded
				sendAsyncMessage(core.addon.id, {aTopic:'clientRequest_clientDying', clientId:clientId, tweeted:gTweeted});
			}
		} else {
			// already tweeted so i dont care if it unloads
			unregister();
		}
	}
}

var twitterReady = false; // set to true after twitter loads, and new tweet modal is opened
function listenForTwitterLoad(aEvent) {
	var aContentWindow = aEvent.target.defaultView;
	var aContentDocument = aContentWindow.document;
	if (aContentWindow.frameElement) {
		console.warn('frame element loaded, so dont respond yet');
	} else {
		if (aContentWindow.location.hostname == TWITTER_HOSTNAME) {
			// twitterReady = true;
			removeEventListener('DOMContentLoaded', listenForTwitterLoad, false);
			init();
		} else {
			console.error('page done loading buts it not twitter, so keep listener attached, im waiting for twitter:', aContentWindow.location);
		}
	}
}

var pendingAttaches = [];

var imgDataUris = {}; // object so it keeps the iIn_arrImgDataUris straight just in case the async stuff mixes up, which it shouldnt, but im new to framescripts so testing
function serverCommand_attachImgDataURIWhenReady(aImgDataUri, a_iIn_arrImgDataUris) {
	// receives data and ensures its attached in the twitter page
	imgDataUris[a_iIn_arrImgDataUris] = {
		imgDataUri: aImgDataUri,
		uploadedUrl: null,
		attachedToTweet: false
	};
	
	if (twitterReady) {
		if (!for_waitUntil_aTest_1_running) {
			do_waitUntil(0, do_overlayIfNoFocus);
		} // else do nothing, as its running, it will find that it needs to be attached
	}
}

function do_openTweetModal() {
	var aContentWindow = content;
	var aContentDocument = content.document;
	var dialogTweet = aContentDocument.getElementById('global-tweet-dialog');
	if (!dialogTweet) {
		throw new Error('no tweet dialog, no clue why, this should not happen, i do the signed in check in init');
	}
	
	if (aContentWindow.getComputedStyle(dialogTweet, null).getPropertyValue('display') == 'none') { // test if open already, if it is, then dont click the button
		// its closed, so lets open it
		var btnNewTweet = aContentDocument.getElementById('global-new-tweet-button'); // id of twitter button :maintain:
		if (!btnNewTweet) {
			// assume not signed in
			// add listener listening to sign in
			addEventListener('DOMContentLoaded', listenForTwitterSignIn, false);
			sendAsyncMessage(core.addon.id, {aTopic:'clientRequest_twitterNotSignedIn', clientId:clientId});
			return;
		}
		
		btnNewTweet.click();
	}
	
	twitterReady = true;
	
	do_waitUntil(0, do_overlayIfNoFocus);
}

const waitForInterval_ms = 100;

var for_waitUntil_aTest_1_currentPreviewElementsCount = 0;
var for_waitUntil_aTest_1_trying_iIn_arr = -1;
var for_waitUntil_aTest_1_running = false;
function do_waitUntil(aTest, aCB, aOptions) {
	
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	
	if (aTest == 0) {
		var modalTweet = aContentDocument.getElementById('global-tweet-dialog-dialog'); // :maintain: with twitter updates
		if (modalTweet) {
			console.log('PASSED found test 0');
			aCB(modalTweet);
		} else {
			console.log('not yet found test 0');
			setTimeout(function() {
				do_waitUntil(aTest, aCB)
			}, waitForInterval_ms);
		}
	} else if (aTest == 1) {
		// aOptions
			// aMaxTry
			// cTry but this is programttic, never st this as devuser
			// richInputTweetMsg - not an option, must set
			// aCBMaxTried - if aMaxTry supplied must do this
		for_waitUntil_aTest_1_running = true;
		var nowPreviewElementsCount = aOptions.richInputTweetMsg.parentNode.querySelectorAll('.previews .preview').length;
		if (nowPreviewElementsCount == for_waitUntil_aTest_1_currentPreviewElementsCount + 1) {
			console.log('PASSED found test 1');
			for_waitUntil_aTest_1_running = false;
			aCB();
		} else if (nowPreviewElementsCount == for_waitUntil_aTest_1_currentPreviewElementsCount) {
			// not yet attached
			console.log('not yet found test 1');
			if (aOptions.aMaxTry) {
				if (aOptions.cTry) {
					aOptions.cTry++;
				} else {
					aOptions.cTry = 1;
				}
				if (aOptions.cTry >= aOptions.aMaxTry) {
					console.log('FAILED TO MAX ATTEMPTS REACHE on found test 1', 'cTry:', aOptions.cTry, 'aMaxTry:', aOptions.aMaxTry);
					for_waitUntil_aTest_1_running = false;
					aOptions.aCBMaxTried();
				} else {
					setTimeout(function() {
						do_waitUntil(aTest, aCB, aOptions);
					}, waitForInterval_ms);
				}
			} else {				
				setTimeout(function() {
					do_waitUntil(aTest, aCB, aOptions);
				}, waitForInterval_ms);
			}
		}
	}
}

var waitForFocus_forAttach;
function do_overlayIfNoFocus(modalTweet) {
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	
	var isFocused_aContentWindow = isFocused(aContentWindow);
	if (!isFocused_aContentWindow) {
		// insert note telling them something will happen
		
		if (!modalTweet) {
			modalTweet = aContentDocument.getElementById('global-tweet-dialog-dialog');
		}
		modalTweet = modalTweet.querySelector('.modal-tweet-form-container'); // :maintain: with twitter updates

		var nativeshotNote = aContentDocument.createElement('div');
		nativeshotNote.setAttribute('style', 'background-color:rgba(255,255,255,0.7); position:absolute; width:' + modalTweet.offsetWidth + 'px; height:' + modalTweet.offsetHeight + 'px; z-index:100; top:' + modalTweet.offsetTop + 'px; left:0px; display:flex; align-items:center; justify-content:center; text-align:center; font-weight:bold;');
		
		var nativeshotText = aContentDocument.createElement('span');
		nativeshotText.setAttribute('style', 'margin-top:-60px;');
		nativeshotText.textContent = 'NativeShot will attach images to this tweet when you focus this tab'
		
		nativeshotNote.appendChild(nativeshotText);
		
		modalTweet.insertBefore(nativeshotNote, modalTweet.firstChild);
		
		waitForFocus_forAttach = function() {
			waitForFocus_forAttach = null;
			aContentWindow.removeEventListener('focus', arguments.callee, false);
			modalTweet.removeChild(nativeshotNote);
			do_attachUnattachedsToTweet();
		};
		
		aContentWindow.addEventListener('focus', waitForFocus_forAttach, false);
		
		// insert note telling them something will happen
	} else {
		do_attachUnattachedsToTweet();
	}
}

function do_attachUnattachedsToTweet() {
	
	// actually attaches it
	var aContentWindow = content;
	var aContentDocument = aContentWindow.document;
	
	for (var a_iIn_arrImgDataUris in imgDataUris) {
		if (!imgDataUris[a_iIn_arrImgDataUris].attachedToTweet) {
			if (!isFocused(aContentWindow)) {
				console.warn('WARNING: tab not focused when trying to INIT/START attachment!'); // assume this is only triggered when focus is in the tab, if it fires when focus is not, then that is bad
				do_overlayIfNoFocus();
				return;
				// did testing aH!! this was the right way, we only need focus when initing so this comment to right is false thought i had earlier: // may have to move this block contents into do_waitUntil aTest==1
			} else {
				var richInputTweetMsg = aContentDocument.getElementById('tweet-box-global'); // :maintain: with twitter updates
				if (imgDataUris[a_iIn_arrImgDataUris].startedAttach) {
					console.log('found non attachedToTweet element in imgDataUris. found that had already startedAttach, trying to check if it attached by now');
					var nowPreviewElementsCount = richInputTweetMsg.parentNode.querySelectorAll('.previews .preview').length;
					if (nowPreviewElementsCount == for_waitUntil_aTest_1_currentPreviewElementsCount + 1) {
						console.log('ok nowPreviewElementsCount is == to 1+old count, so im assuming yes it attached, POSSIBLY not accurate test, as maybe some other item attached');
						if (for_waitUntil_aTest_1_trying_iIn_arr == a_iIn_arrImgDataUris) {
							console.log('yes the for_waitUntil_aTest_1_trying_iIn_arr is the same as this a_iIn_arrImgDataUris');
							imgDataUris[for_waitUntil_aTest_1_trying_iIn_arr].attachedToTweet = true;
							continue;
						} else {
							console.error('mismatch', 'a_iIn_arrImgDataUris:', a_iIn_arrImgDataUris, 'for_waitUntil_aTest_1_trying_iIn_arr:', for_waitUntil_aTest_1_trying_iIn_arr, 'i didnt think logic this deep as devuser so can use more work here');
							throw new Error('mistmatch on for_waitUntil_aTest_1_trying_iIn_arr and a_iIn_arrImgDataUris!');
						}
					} else if (nowPreviewElementsCount == for_waitUntil_aTest_1_currentPreviewElementsCount) {
						console.error('nowPreviewElementsCount is same as since before it started, so test if its currently still in the do_waitUntil, if it is then just return to wait. IF it is not in do_waitUntil then MAYBE try again, but im not sure if this is accurate');
						if (for_waitUntil_aTest_1_running) {
							console.log('seems like its still running for:', for_waitUntil_aTest_1_trying_iIn_arr);
							if (a_iIn_arrImgDataUris == for_waitUntil_aTest_1_trying_iIn_arr) {
								console.log('which is == to the one im testing, so just return', 'btw the one im testing is:', a_iIn_arrImgDataUris);
								return;
							} else {
								console.error('it is running for SOME OTHER a_iIn_arrImgDataUris! it is running for:', for_waitUntil_aTest_1_trying_iIn_arr, 'and the one im testing the one i found marked still attaching (startedAttach) is:', a_iIn_arrImgDataUris);
								throw new Error('whaaaaa?');
							}
						} else {
							throw new Error('nowPreviewElementsCount is same as since before it started, and NOTHING is running, so wtf  this didnt attach?');
						}
					} else {
						throw new Error('nowPreviewElementsCount is not same nor 1 + before startedAttach - so im confused now as devuser i didnt think logic into this deep');
					}
				}
				for_waitUntil_aTest_1_trying_iIn_arr = a_iIn_arrImgDataUris;
				imgDataUris[for_waitUntil_aTest_1_trying_iIn_arr].startedAttach = true;
				for_waitUntil_aTest_1_currentPreviewElementsCount = richInputTweetMsg.parentNode.querySelectorAll('.previews .preview').length;
				console.info('pre wait count:', for_waitUntil_aTest_1_currentPreviewElementsCount);
				var img = aContentDocument.createElement('img');
				img.setAttribute('src', imgDataUris[a_iIn_arrImgDataUris].imgDataUri);
				richInputTweetMsg.appendChild(img);
				
				var daOptions = {
					aMaxTry: (1000 / waitForInterval_ms) * 5, // try for this many seconds // 10 tries per sec // try * 5 means try 50 times means try for 5 sec
					aCBMaxTried: function() {
						imgDataUris[for_waitUntil_aTest_1_trying_iIn_arr].failedToAttach = true;  // can also use a_iIn_arrImgDataUris instead of the for_waitUntil_aTest_1_trying_iIn_arr, but i feel using for_ is more robust
						// :todo: handle this, maybe offer save to disk
					},
					richInputTweetMsg: richInputTweetMsg
				};
				
				do_waitUntil(1, function() {
					console.log('succesfully _iIn_arr:', for_waitUntil_aTest_1_trying_iIn_arr, 'took this many attempts:', daOptions.cTry, 'this many seconds:', ((daOptions.cTry * waitForInterval_ms) / 1000));
					imgDataUris[for_waitUntil_aTest_1_trying_iIn_arr].attachedToTweet = true; // can also use a_iIn_arrImgDataUris instead of the for_waitUntil_aTest_1_trying_iIn_arr, but i feel using for_ is more robust
					do_attachUnattachedsToTweet();
				}, daOptions);
				return; // just return here, even though there is a break after this, but for sure we want to quit at this point
			}
			break;
		}
	}
	
	// :todo: after attaching, test to verify it attached to tweet
	// :todo: also test for listener on modal close, then notify in user bar that images from tweet detached

}
// END - custom functionalities

// START - helper functions
function isFocused(window) {
    let childTargetWindow = {};
    Services.focus.getFocusedElementForWindow(window, true, childTargetWindow);
    childTargetWindow = childTargetWindow.value;

    let focusedChildWindow = {};
    if (Services.focus.activeWindow) {
        Services.focus.getFocusedElementForWindow(Services.focus.activeWindow, true, focusedChildWindow);
        focusedChildWindow = focusedChildWindow.value;
    }

    return (focusedChildWindow === childTargetWindow);
}
function getLoadContext(request) {
    var loadContext = null;

    if (request instanceof Ci.nsIRequest) {
        try {
            if (request.loadGroup && request.loadGroup.notificationCallbacks) {
                loadContext = request.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);
            }
        } catch (ex) {
            console.exception('request loadGroup with notificationCallbacks but oculd not get nsIloadContext', ex);
            try {
                if (request.notificationCallbacks) {
                    loadContext = request.notificationCallbacks.getInterface(Ci.nsILoadContext);
                }
            } catch (ex) {
                console.exception('request has notificationCallbacks but could not get nsILoadContext', ex);
                /* start - noit's backup try, it might be redundant (im not sure) as Wladamir Palant didn't have this way*/
                try {
                    var interfaceRequestor = httpChannel.notificationCallbacks.QueryInterface(Ci.nsIInterfaceRequestor);
                    loadContext = interfaceRequestor.getInterface(Ci.nsILoadContext);
                } catch (ex) {
                    console.exception('backup method failed:', ex); // fixed on aug 14 2015
                }
                /* end - my backup try, it might be redundant as Wladamir Palant didn't have this way*/
            }
        }
    } else {
        console.warn('request argument is not instance of nsIRequest')
    }

    return loadContext;
}
// END - helper functions

console.error('ContentFrameMessageManager:', gContentFrameMessageManager);
register();