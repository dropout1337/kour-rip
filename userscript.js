// ==UserScript==
// @name         Kour.rip
// @match        *://kour.io/*
// @version      1.0.0
// @author       dropout (https://github.com/dropout1337)
// @description  Basic Kour.io exploits/cheat. Feel free to paste it kiddie.
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

const Signatures = {
    ping:              "f3 07 01 00 00", // Filter
    pong:              "f3 06 01 01 01", // Filter
    anotherPing:       "f3 04 e2 03 e3", // Filter

    createGame:        "f3 02 e3 03 ff 07 06", // Create Game / Party (Can be used to change partyId)
    updateState:       "f3 02 fd 02 f4 03 c8", // Insta-kill
    damageTaken:       "f3 04 c8 02 f5 15 04", // Invisibility

    connectStarts:     "f3 02 e", // Connect (start)
    connectEnds:       "f1 1c e8 1c bf 0b 23" // Connect (end)
}

class Kour {
    constructor() {
        // sockets: list of WebSocket
        this.sockets = [];

        // What features you want enabled
        this.config = {
            Invisible: true,
            InstantKill: false,
            DisableMarketing: true,
        }

        // Current packet count (not used, just visually)
        this.packets = 0;

        // Hook window.WebSocket
        unsafeWindow.WebSocket = class extends WebSocket {
            constructor() {
                super(...arguments);
        
                this.addEventListener("open", event => {
                    // Add to this.sockets list.
                    kourInstance.sockets.push(this);

                    // Hook send/onmessage
                    kourInstance.hook(this);
                });
            }
        }
    }

    /**
    * Converts an array of hexadecimal strings to a human-readable string.
    * 
    * @param {string[]} hexArray - An array of strings, where each string represents a hexadecimal number.
    * @returns {string} - A string where each character is derived from the corresponding hexadecimal value.
    */
    hexArrayToString(hexArray) {
        let str = '';

        for (let i = 0; i < hexArray.length; i++) {
            let hex = hexArray[i];
            let decimalValue = parseInt(hex, 16);

            str += String.fromCharCode(decimalValue);
        }

        return str;
    }

    /**
    * Sends messages in the chat to help promote kour.rip :3
    */
    marketing() {
        if (!this.config.DisableMarketing) kourMessager.send("<sprite=0> <color=#F8CEFF>github.com<color=white>/<color=#F8CEFF>dropout1337<color=white>/<color=#F8CEFF>kour-rip<color=white> <sprite=0>")
    }

    /**
    * Hooks into the WebSocket instance to intercept and log WebSocket messages and sends.
    *
    * @param {WebSocket} socket - The WebSocket instance to hook into.
    */
    hook(socket) {
        console.debug("%c !! ", "background:#7aadff;color:#000", `Intercepted WebSocket (${socket.url})`);

        const send = socket.send; // Original send function
        const onmessage = socket.onmessage; // Original onmessage function

        socket.onmessage = (event) => {
            if (event.data == null) {
                return onmessage.call(socket, event);
            }

            this.packets += 1;

            let hexArray = Array.from(new Uint8Array(event.data)).map(byte => byte.toString(16).padStart(2, '0'));
            let uint8Array = new Uint8Array(event.data);
            let stringHexArray = hexArray.join(" ");

            if (stringHexArray == "") return onmessage.call(socket, event);
            if (stringHexArray.startsWith(Signatures.ping)) return onmessage.call(socket, event);
            if (stringHexArray.startsWith(Signatures.anotherPing)) return onmessage.call(socket, event);
            
            // If the event is a Damage/Shoot event ignore it.
            if (stringHexArray.startsWith(Signatures.damageTaken) && this.config.Invisible) {
                return;
            }

            this.marketing();

            console.debug("%c <= ", "background:#FF6A19;color:#000", JSON.stringify({
                "hex_array": stringHexArray,
                "array": uint8Array,
                "base64": btoa(String.fromCharCode.apply(null, new Uint8Array(hexArray.map(hex => parseInt(hex, 16))))),
                "string": this.hexArrayToString(hexArray)
            }));

            return onmessage.call(socket, event);
        };

        socket.send = (data) => {
            this.packets += 1;

            let hexArray = Array.from(new Uint8Array(data)).map(byte => byte.toString(16).padStart(2, '0'));
            let uint8Array = new Uint8Array(data);
            let stringHexArray = hexArray.join(" ");

            if (stringHexArray == "") return send.call(socket, data);
            if (stringHexArray.startsWith(Signatures.pong)) return send.call(socket, data);

            if (stringHexArray.startsWith(Signatures.createGame)) {
                let partyId = this.hexArrayToString(hexArray.slice(7, 13));
                console.debug("%c => ", "background:#7F7;color:#000", "Creating game:", partyId);
                return send.call(socket, data);
            } else if (stringHexArray.startsWith(Signatures.updateState)  && this.config.InstantKill) { // Repeat state packets (movement, crouch, jump, shoot, switch weapon), causes the game to send 40 of the same packet. So if we shoot we actually send 40 damage packets instead of 1.
                console.debug("%c => ", "background:#7F7;color:#000", "State repeated.");

                for (let i = 0; i < 40; i++) {
                    send.call(socket, data);
                }

                this.marketing();
                return send.call(socket, data);
            } else if (stringHexArray.startsWith(Signatures.connectStarts) && stringHexArray.endsWith(Signatures.connectEnds)) {
                console.debug("%c => ", "background:#7F7;color:#000", "Connecting to game.", this.hexArrayToString(hexArray));
                return send.call(socket, data);
            }

            console.debug("%c => ", "background:#7F7;color:#000", JSON.stringify({
                "hex_array": stringHexArray,
                "array": uint8Array,
                "base64": btoa(String.fromCharCode.apply(null, new Uint8Array(hexArray.map(hex => parseInt(hex, 16))))),
                "string": this.hexArrayToString(hexArray)
            }));

            return send.call(socket, data);
        };
    }

    /**
    * Draws the watermark onto the unity-canvas.
    */
    watermark() {
        let overlayCanvas = document.createElement("canvas");
        let unityContainer = document.getElementById("unity-container");
    
        overlayCanvas.width = unityContainer.clientWidth;
        overlayCanvas.height = unityContainer.clientHeight;
    
        overlayCanvas.style.position = "absolute";
        overlayCanvas.style.top = "50%";
        overlayCanvas.style.left = "50%";
        overlayCanvas.style.transform = "translate(-50%, -50%)";
        overlayCanvas.style.pointerEvents = "none";
    
        unityContainer.appendChild(overlayCanvas);
    
        let ctx = overlayCanvas.getContext("2d");
    
        ctx.font = "15px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
    
        let opacity = 0;
        let delta = 0.03;
    
        function animate() {
            let lines = [`kour.rip (${kourInstance.packets})`];

            if (kourInstance.config.Invisible) {
                lines.push("<c>✔ Invisible")
            } else {
                lines.push("<c>✖ Invisible")
            }

            if (kourInstance.config.InstantKill) {
                lines.push("<c>✔ Instant-Kill")
            } else {
                lines.push("<c>✖ Instant-Kill")
            }

            let lineHeight = 20;
            let startY = overlayCanvas.height / 2 - ((lines.length - 1) * lineHeight) / 2 + 60;
            let centerX = overlayCanvas.width / 2;
            
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
            opacity += delta;
    
            if (opacity > 1) {
                opacity = 1;
                delta = -delta;
            } else if (opacity < 0) {
                opacity = 0;
                delta = -delta;
            }
    
            ctx.globalAlpha = opacity;
    
            lines.forEach((line, index) => {
                if (line.includes("<c>")) {
                    line = line.replace("<c>", "");
                    ctx.fillStyle = "#F8CEFF";
                } else {
                    ctx.fillStyle = "white";
                }
                ctx.fillText(line, centerX, startY + index * lineHeight);
            });
    
            ctx.globalAlpha = 1;
            requestAnimationFrame(animate);
        }
    
        animate();
    }
}

class Message {
    constructor() {
        this.msgArray = [243, 2, 253, 3, 246, 3, 1, 244, 34, 245, 23, 1, 7];
        this.sockets = kourInstance.sockets;
    }

    /**
    * Converts a given string into an array of decimal ASCII codes.
    * 
    * @param {string} text - The input text to be encoded.
    * @returns {number[]} An array of decimal ASCII codes representing each character in the input text.
    */
    encodeDec(text) {
        const decArray = [];

        for (let i = 0; i < text.length; i++) {
            decArray.push(text.charCodeAt(i));
        }

        return decArray;
    }

    /**
    * Sends a message through the last socket in the sockets array.
    * 
    * @param {string} msg - The message to be sent.
    */
    send(msg) {
        let socket = this.sockets[this.sockets.length - 1];

        let msgArray = [...this.msgArray];

        let savedlength = msg.length;
        let amount = Math.floor(savedlength/128);
        let strLength = [];
        if (savedlength > 128) {
            strLength.push(128 + (savedlength % 128));
            strLength.push(amount);
        } else {
            strLength.push(savedlength);
        }

        msgArray.push(...strLength);
        msgArray.push(...this.encodeDec(msg));

        socket.send(new Uint8Array(msgArray));
    }
}

const kourInstance = new Kour();
const kourMessager = new Message();

unsafeWindow.kourInstance = kourInstance;
unsafeWindow.kourMessager = kourMessager;

window.addEventListener("load", kourInstance.watermark);
