// Copyright 2021 GlitchyByte
// SPDX-License-Identifier: Apache-2.0

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
                    case "update-state": return this.updateState(request, sendResponse)
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

        updateState(request, sendResponse) {
            const url = request.url
            const isSyncEnabled = request.isSyncEnabled
            const isAutoplayEnabled = request.isAutoplayEnabled
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
                    })
                    .then(changed => {
                        if (isAutoplayEnabled && changed) {
                            this.playSimulation()
                        }
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
            this.timeoutId = null
            const nextButton = document.querySelector(".next-button")
            const config = { attributes: true }
            const observer = new MutationObserver(this.mutationCallback.bind(this))
            observer.observe(nextButton, config)
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
                    const playPauseButton = document.querySelector(".play-pause-button")
                    playPauseButton.click()
                    this.timeoutId = null
                }).bind(this), 10000)
            }
        }
    }
    // Initialize.
    window.glitchyByteSimulationPlayerContext = new GlitchyByteSimulationPlayerContext()
}
