// Copyright 2021-2022 GlitchyByte
// SPDX-License-Identifier: MIT-0

// Embedded setup.

if (document.querySelector(".play") && !window.glitchyByteMainFrameContext) {
    // Define.
    class GlitchyByteMainFrameContext {

        constructor() {
            this.storage = new Map()
            this.programHash = null
            this.timeoutId = null
            const listener = (request, sender, sendResponse) => {
                switch (request.message) {
                    case "set-item": return this.setItem(request, sendResponse)
                    case "get-item": return this.getItem(request, sendResponse)
                    case "update-state": return this.updateState(request, sender, sendResponse)
                }
            }
            chrome.runtime.onMessage.addListener(listener.bind(this))
        }

        setItem(request, sendResponse) {
            this.storage.set(request.key, request.value)
            sendResponse()
        }

        getItem(request, sendResponse) {
            const value = this.storage.get(request.key)
            sendResponse(value)
        }

        updateState(request, sender, sendResponse) {
            const url = request.url
            const isSyncEnabled = request.isSyncEnabled
            const isAutoplayEnabled = request.isAutoplayEnabled
            this.sendToSimulationPlayer({ message: "update-autoplay-enabled", isAutoplayEnabled: isAutoplayEnabled })
            if (this.timeoutId) {
                clearTimeout(this.timeoutId)
                this.timeoutId = null
                this.programHash = null
            }
            if (isSyncEnabled) {
                this.timeoutId = this.scheduleSync(url, isAutoplayEnabled)
            }
            sendResponse()
        }

        sendToSimulationPlayer(data) {
            const frame = document.querySelector(".cg-player-sandbox iframe")
            frame.contentWindow.postMessage(data, "*")
        }

        scheduleSync(url, isAutoplayEnabled) {
            const request = new Request(url, { mode: "cors" })
            const action = () => {
                fetch(request)
                    .then(response => {
                        if (response.ok) {
                            return response.text()
                        }
                        return null
                    })
                    .then(text => {
                        if (text) {
                            return this.dispatchNewProgram(text)
                        }
                        return false
                    })
                    .then(isChanged => {
                        if (isAutoplayEnabled && isChanged) {
                            setTimeout(this.playSimulation.bind(this), 250)
                        }
                        this.timeoutId = this.scheduleSync(url, isAutoplayEnabled)
                    })
                    .catch(error => {
                        this.timeoutId = this.scheduleSync(url, isAutoplayEnabled)
                    })
            }
            return setTimeout(action.bind(this), 3000);
        }

        async dispatchNewProgram(program) {
            const hash = await this.getHexHash(program)
            if (hash == this.programHash) {
                return false
            }
            window.document.dispatchEvent(new CustomEvent("ExternalEditorToIDE", {
                detail: {
                    status: "updateCode",
                    code: program
                }
            }))
            this.programHash = hash
            return true
        }

        async getHexHash(text) {
            const encoded = new TextEncoder().encode(text)
            const buffer = await crypto.subtle.digest('SHA-256', encoded)
            const bytes = Array.from(new Uint8Array(buffer))
            const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('')
            return hex
        }

        playSimulation() {
            const playButton = document.querySelector(".play")
            const replayButton = document.querySelector(".replay")
            if (replayButton.disabled) {
                playButton.click()
            } else {
                replayButton.click()
            }
        }
    }
    // Initialize.
    window.glitchyByteMainFrameContext = new GlitchyByteMainFrameContext()
}

if (document.querySelector(".play-pause-button") && !window.glitchyByteSimulationPlayerContext) {
    // Define.
    class GlitchyByteSimulationPlayerContext {

        constructor() {
            this.isAutoplayEnabled = false
            this.timeoutId = null
            addEventListener("message", (event => {
                if (!event.origin.startsWith("https://www.codingame.com")) {
                    return
                }
                switch (event.data.message) {
                    case "update-autoplay-enabled": return this.updateAutoplayEnabled(event.data)
                }
            }).bind(this))
            const nextButton = document.querySelector(".next-button")
            const config = { attributes: true }
            const observer = new MutationObserver(this.mutationCallback.bind(this))
            observer.observe(nextButton, config)
        }

        updateAutoplayEnabled(data) {
            this.isAutoplayEnabled = data.isAutoplayEnabled
        }

        mutationCallback(mutationList, observer) {
            const nextButton = document.querySelector(".next-button")
            const shouldPlay = nextButton.disabled
            if (shouldPlay) {
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId)
                    this.timeoutId = null
                }
                this.timeoutId = setTimeout((() => {
                    this.timeoutId = null
                    if (!this.isAutoplayEnabled) {
                        return
                    }
                    const playPauseButton = document.querySelector(".play-pause-button")
                    playPauseButton.click()
                }).bind(this), 10000)
            }
        }
    }
    // Initialize.
    window.glitchyByteSimulationPlayerContext = new GlitchyByteSimulationPlayerContext()
}
