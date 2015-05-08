'use strict';

// Imports
importScripts('resource://gre/modules/osfile.jsm');
importScripts('resource://gre/modules/workers/require.js');

// Globals
const core = { // have to set up the main keys that you want when aCore is merged from mainthread in init
	addon: {
		path: {
			content: 'chrome://nativeshot/content/',
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	},
	firefox: {}
};

var OSStuff = {}; // global vars populated by init, based on OS

// Imports that use stuff defined in chrome
// I don't import ostypes_*.jsm yet as I want to init core first, as they use core stuff like core.os.isWinXP etc
// imported scripts have access to global vars on MainWorker.js
importScripts(core.addon.path.content + 'modules/cutils.jsm');
importScripts(core.addon.path.content + 'modules/ctypes_math.jsm');

// Setup PromiseWorker
var PromiseWorker = require(core.addon.path.content + 'modules/workers/PromiseWorker.js');
var worker = new PromiseWorker.AbstractWorker();
worker.dispatch = function(method, args = []) {
	return self[method](...args);
};
worker.postMessage = function(result, ...transfers) {
	self.postMessage(result, ...transfers);
};
worker.close = function() {
	self.close();
};
self.addEventListener('message', msg => worker.handleMessage(msg));

////// end of imports and definitions

function init(objCore) {
	//console.log('in worker init');
	
	// merge objCore into core
	// core and objCore is object with main keys, the sub props
	
	for (var p in objCore) {
		/* // cant set things on core as its const
		if (!(p in core)) {
			core[p] = {};
		}
		*/
		
		for (var pp in objCore[p]) {
			core[p][pp] = objCore[p][pp];
		}
	}

	// I import ostypes_*.jsm in init as they may use things like core.os.isWinXp etc
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			importScripts(core.addon.path.content + 'modules/ostypes_win.jsm');
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
	
	// OS Specific Init
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				OSStuff.hiiii = true;
				
			break;
		default:
			// do nothing special
	}
	
	return true;
}

// Start - Addon Functionality
function shootMon(mons) {
	// mons
		// 0 - primary monitor
		// 1 - all monitors
		// 2 - monitor where the mouse currently is
		
	
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
				
				console.time('winapi');
				
				var rezArr = [];
				
				if (mons == 0) {
					rezArr.push({
						argsCreateDC: {
							lpszDriver: ostypes.TYPE.LPCTSTR.targetType.array()('DISPLAY'),
							lpszDevice: null
						},
						xTopLeft: 0,
						yTopLeft: 0
					});
				} else  if (mons == 1) {
					// get all monitors
					/*
					var iDevNum = -1;
					while (true) {
						iDevNum++;
						var lpDisplayDevice = ostypes.TYPE.DISPLAY_DEVICE();
						lpDisplayDevice.cb = ostypes.TYPE.DISPLAY_DEVICE.size;
						var rez_EnumDisplayDevices = ostypes.API('EnumDisplayDevices')(null, iDevNum, lpDisplayDevice.address(), null);
						console.info('rez_EnumDisplayDevices:', rez_EnumDisplayDevices.toString(), uneval(rez_EnumDisplayDevices), cutils.jscGetDeepest(rez_EnumDisplayDevices));
						if (cutils.jscEqual(rez_EnumDisplayDevices, 0)) { // ctypes.winLastError != 0
							// iDevNum is greater than the largest device index.
							break;
						}
						
						if (lpDisplayDevice.StateFlags & ostypes.CONST.DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) {
							rezArr.push({
								argsCreateDC: {
									lpszDriver: null,
									lpszDevice: lpDisplayDevice.DeviceName
								},
								xTopLeft: parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.left)),
								yTopLeft: parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.top))
							});
						}
					}
					*/ // discontinued this because i have to make another call to get topleft x,y of the monitor, that wouldnt be s obad, but this enums non-displays too so thats wasted overhead, the good thing about this thing though was it gave DeviceName, but so now ill just use EnuMDisplayMonitors and then that gives rect and cMon, then ill take cMon to GetMonitorInfo to get DeviceName, so thats just a call per what i actually need so opting for that
					
					var jsMonitorEnumProc = function(hMonitor, hdcMonitor, lprcMonitor, dwData) {
						console.log('in jsMonitorEnumProc', 'hMonitor:', hMonitor.toString(), 'lprcMonitor:', lprcMonitor.contents.toString()); // link3687324
						rezArr.push({
							xTopLeft: parseInt(cutils.jscGetDeepest(lprcMonitor.contents.left)),
							yTopLeft: parseInt(cutils.jscGetDeepest(lprcMonitor.contents.top))
						});
						rezArr[rezArr.length - 1].nWidth = parseInt(cutils.jscGetDeepest(lprcMonitor.contents.right)) - rezArr[rezArr.length - 1].xTopLeft;
						rezArr[rezArr.length - 1].nHeight = parseInt(cutils.jscGetDeepest(lprcMonitor.contents.bottom)) - rezArr[rezArr.length - 1].yTopLeft;
						
						// get device name
						var cMonInfo = ostypes.TYPE.MONITORINFOEX();
						cMonInfo.cbSize = ostypes.TYPE.MONITORINFOEX.size;
						var rez_GetMonitorInfo = ostypes.API('GetMonitorInfo')(hMonitor, cMonInfo.address());
						console.info('rez_GetMonitorInfo:', rez_GetMonitorInfo.toString(), uneval(rez_GetMonitorInfo), cutils.jscGetDeepest(rez_GetMonitorInfo));
						if (cutils.jscEqual(rez_GetMonitorInfo, 0)) {
							console.error('Failed rez_GetMonitorInfo, winLastError:', ctypes.winLastError);
							throw new Error({
								name: 'os-api-error',
								message: 'Failed rez_GetMonitorInfo, winLastError: "' + ctypes.winLastError + '" and rez_GetMonitorInfo: "' + rez_GetMonitorInfo.toString(),
								winLastError: ctypes.winLastError
							});
						}
						
						rezArr[rezArr.length-1].argsCreateDC = {
							lpszDriver: null,
							lpszDevice: cMonInfo.szDevice
						};
						
						return true; // continue enumeration
					}
					var cMonitorEnumProc = ostypes.TYPE.MONITORENUMPROC.ptr(jsMonitorEnumProc);
					var rez_EnumDisplayMonitors = ostypes.API('EnumDisplayMonitors')(null, null, cMonitorEnumProc, 0);
					console.log('post rez_EnumDisplayMonitors'); // good, this test proves that "in jsMonitorEnumProc, lprcMonitor" callbacks complete before EnuMDisplayMonitors unblocks link3687324
					console.info('rez_EnumDisplayMonitors:', rez_EnumDisplayMonitors.toString(), uneval(rez_EnumDisplayMonitors), cutils.jscGetDeepest(rez_EnumDisplayMonitors));
					if (ctypes.winLastError != 0) {
						console.error('Failed rez_EnumDisplayMonitors, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_EnumDisplayMonitors, winLastError: "' + ctypes.winLastError + '" and rez_EnumDisplayMonitors: "' + rez_EnumDisplayMonitors.toString(),
							winLastError: ctypes.winLastError
						});
					}
				} else if (mons == 2) {
					var cPoint = ostypes.TYPE.POINT();
					var rez_GetCursorPos = ostypes.API('GetCursorPos')(cPoint.address());
					console.info('rez_GetCursorPos:', rez_GetCursorPos.toString(), uneval(rez_GetCursorPos), cutils.jscGetDeepest(rez_GetCursorPos));
					if (ctypes.winLastError != 0) {
						console.error('Failed rez_GetCursorPos, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_GetCursorPos, winLastError: "' + ctypes.winLastError + '" and rez_GetCursorPos: "' + rez_GetCursorPos.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var cMon = ostypes.API('MonitorFromPoint')(cPoint, ostypes.CONST.MONITOR_DEFAULTTONEAREST);
					console.info('cMon:', cMon.toString(), uneval(cMon), cutils.jscGetDeepest(cMon));
					if (cMon.isNull()) { // removed `ctypes.winLastError != 0` because docs dont specify we can check last error and i didnt test it
						console.error('Failed cMon, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed cMon, winLastError: "' + ctypes.winLastError + '" and cMon: "' + cMon.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var cMonInfo = ostypes.TYPE.MONITORINFOEX();
					cMonInfo.cbSize = ostypes.TYPE.MONITORINFOEX.size;
					var rez_GetMonitorInfo = ostypes.API('GetMonitorInfo')(cMon, cMonInfo.address());
					console.info('rez_GetMonitorInfo:', rez_GetMonitorInfo.toString(), uneval(rez_GetMonitorInfo), cutils.jscGetDeepest(rez_GetMonitorInfo));
					if (cutils.jscEqual(rez_GetMonitorInfo, 0)) {
						console.error('Failed rez_GetMonitorInfo, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_GetMonitorInfo, winLastError: "' + ctypes.winLastError + '" and rez_GetMonitorInfo: "' + rez_GetMonitorInfo.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					console.info('cMonInfo.rcMonitor:', cMonInfo.rcMonitor.toString());
					
					rezArr.push({
						argsCreateDC: {
							lpszDriver: null,
							lpszDevice: cMonInfo.szDevice
						},
						xTopLeft: parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.left)),
						yTopLeft: parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.top))
					});
					rezArr[rezArr.length - 1].nWidth = parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.right)) - rezArr[rezArr.length - 1].xTopLeft;
					rezArr[rezArr.length - 1].nHeight = parseInt(cutils.jscGetDeepest(cMonInfo.rcMonitor.bottom)) - rezArr[rezArr.length - 1].yTopLeft;
				} else {
					throw new Error({
						name: 'devuser-error',
						message: 'Invalid paramter of "' + mons + '" passed to mons argument'
					})
				}
				
				for (var s=0; s<rezArr.length; s++) {
					var hdcScreen = ostypes.API('CreateDC')(rezArr[s].argsCreateDC.lpszDriver, rezArr[s].argsCreateDC.lpszDevice, null, null);
					//console.info('hdcScreen:', hdcScreen.toString(), uneval(hdcScreen), cutils.jscGetDeepest(hdcScreen));
					if (ctypes.winLastError != 0) {
						//console.error('Failed hdcScreen, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcScreen, winLastError: "' + ctypes.winLastError + '" and hdcScreen: "' + hdcScreen.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					delete rezArr[s].argsCreateDC; // as we dont want to return CData to mainthread
					
					var nWidth = 'nWidth' in rezArr[s] ? rezArr[s].nWidth : parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.HORZRES)));
					var nHeight = 'nHeight' in rezArr[s] ? rezArr[s].nHeight : parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.VERTRES)));
					var nBPP = parseInt(cutils.jscGetDeepest(ostypes.API('GetDeviceCaps')(hdcScreen, ostypes.CONST.BITSPIXEL)));
					
					rezArr[s].nWidth = nWidth; // in case it didnt have nWidth in rezArr[s]
					rezArr[s].nHeight = nHeight; // in case it didnt have nHeight in rezArr[s]
					
					console.info('nWidth:', nWidth, 'nHeight:', nHeight, 'nBPP:', nBPP);
					
					var w = nWidth;
					var h = nHeight;
					
					var modW = w % 4;
					var useW = modW != 0 ? w + (4-modW) : w;
					console.log('useW:', useW, 'realW:', w);
					var arrLen = useW * h * 4;
					var imagedata = new ImageData(useW, h);
					
					var hdcMemoryDC = ostypes.API('CreateCompatibleDC')(hdcScreen); 
					//console.info('hdcMemoryDC:', hdcMemoryDC.toString(), uneval(hdcMemoryDC), cutils.jscGetDeepest(hdcMemoryDC));
					if (ctypes.winLastError != 0) {
						//console.error('Failed hdcMemoryDC, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed hdcMemoryDC, winLastError: "' + ctypes.winLastError + '" and hdcMemoryDC: "' + hdcMemoryDC.toString(),
							winLastError: ctypes.winLastError
						});
					}

					// CreateDIBSection stuff
					var bmi = ostypes.TYPE.BITMAPINFO();
					bmi.bmiHeader.biSize = ostypes.TYPE.BITMAPINFOHEADER.size;
					bmi.bmiHeader.biWidth = nWidth;
					bmi.bmiHeader.biHeight = -1 * nHeight; // top-down
					bmi.bmiHeader.biPlanes = 1;
					bmi.bmiHeader.biBitCount = nBPP; // 32
					bmi.bmiHeader.biCompression = ostypes.CONST.BI_RGB;
					
					var pixelBuffer = ostypes.TYPE.BYTE.ptr();
					//console.info('PRE pixelBuffer:', pixelBuffer.toString(), 'pixelBuffer.addr:', pixelBuffer.address().toString());
					// CreateDIBSection stuff
					
					var hbmp = ostypes.API('CreateDIBSection')(hdcScreen, bmi.address(), ostypes.CONST.DIB_RGB_COLORS, pixelBuffer.address(), null, 0); 
					if (hbmp.isNull()) { // do not check winLastError when using v5, it always gives 87 i dont know why, but its working
						console.error('Failed hbmp, winLastError:', ctypes.winLastError, 'hbmp:', hbmp.toString(), uneval(hbmp), cutils.jscGetDeepest(hbmp));
						throw new Error({
							name: 'os-api-error',
							message: 'Failed hbmp, winLastError: "' + ctypes.winLastError + '" and hbmp: "' + hbmp.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var rez_SO = ostypes.API('SelectObject')(hdcMemoryDC, hbmp);
					//console.info('rez_SO:', rez_SO.toString(), uneval(rez_SO), cutils.jscGetDeepest(rez_SO));
					if (ctypes.winLastError != 0) {
						//console.error('Failed rez_SO, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_SO, winLastError: "' + ctypes.winLastError + '" and rez_SO: "' + rez_SO.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					var rez_BB = ostypes.API('BitBlt')(hdcMemoryDC, 0, 0, nWidth, nHeight, hdcScreen, 0, 0, ostypes.CONST.SRCCOPY);
					//console.info('rez_BB:', rez_BB.toString(), uneval(rez_BB), cutils.jscGetDeepest(rez_BB));
					if (ctypes.winLastError != 0) {
						//console.error('Failed rez_BB, winLastError:', ctypes.winLastError);
						throw new Error({
							name: 'os-api-error',
							message: 'Failed rez_BB, winLastError: "' + ctypes.winLastError + '" and rez_BB: "' + rez_BB.toString(),
							winLastError: ctypes.winLastError
						});
					}
					
					console.timeEnd('winapi');
					
					console.time('memcpy');
					ostypes.API('memcpy')(imagedata.data, pixelBuffer, arrLen);
					console.timeEnd('memcpy');
					
					// swap bytes to go from BRGA to RGBA
					// Reorganizing the byte-order is necessary as canvas can only hold data in RGBA format (little-endian, ie. ABGR in the buffer). Here is one way to do this:
					console.time('BGRA -> RGBA');
					var dataRef = imagedata.data;
					var pos = 0;
					while (pos < arrLen) {
						var B = dataRef[pos];

						dataRef[pos] = dataRef[pos+2];
						dataRef[pos+2] = B;

						pos += 4;
					}
					console.timeEnd('BGRA -> RGBA');
					
					rezArr[s].idat = imagedata;
				}
				
				return rezArr;
				
			break;
		default:
			throw new Error({
				name: 'addon-error',
				message: 'Operating system, "' + OS.Constants.Sys.Name + '" is not supported'
			});
	}
}
// End - Addon Functionality

var txtEn = new TextEncoder()
var pth = OS.Path.join(OS.Constants.Path.desktopDir, 'logit.txt');

function logit(txt) {
	var valOpen = OS.File.open(pth, {write: true, append: true});
	var valWrite = valOpen.write(txtEn.encode(txt + '\n'));
	valOpen.close();
}