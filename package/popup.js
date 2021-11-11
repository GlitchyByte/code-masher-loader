// Copyright 2021 GlitchyByte
// SPDX-License-Identifier: Apache-2.0

// Popup.

class CodeSyncState {

    static fromJson(json) {
        const state = JSON.parse(json)
        return state ? new CodeSyncState(state.url, state.isSyncEnabled, state.isAutplayEnabled) : new CodeSyncState()
    }

    constructor(url = "http://localhost:10101/Player.java", isSyncEnabled = false, isAutplayEnabled = false) {
        this.url = url
        this.isSyncEnabled = isSyncEnabled
        this.isAutplayEnabled = isAutplayEnabled
    }

    toJson() {
        return JSON.stringify(this)
    }
}

class Popup {

    constructor() {
        // Get interactive elements.
        this.sourceUrlElement = document.querySelector("#source_code_url")
        this.syncEnabledElement = document.querySelector("#sync_code_checkbox")
        this.autoplayEnabledElement = document.querySelector("#autoplay_checkbox")
    }

    async getTabId() {
        const queryOptions = {
            active: true,
            currentWindow: true
        }
        const [tab] = await chrome.tabs.query(queryOptions)
        return tab.id
    }

    async run() {
        // Get tabId.
        this.tabId = await this.getTabId()
        // Attach listeners.
        this.sourceUrlElement.addEventListener("input", this.onSourceUrlChange.bind(this))
        this.syncEnabledElement.addEventListener("change", this.onSyncEnabledChange.bind(this))
        this.autoplayEnabledElement.addEventListener("change", this.onAutoplayEnabledChange.bind(this))
        // Setup context in tab.
        this.setupContext()
            .then(this.restoreState.bind(this))
    }

    setupContext() {
        const tabId = this.tabId
        return new Promise((resolve, reject) => {
            chrome.scripting.executeScript({
                target: { tabId: tabId, allFrames: true },
                files: [ "setup.js" ]
            }, (results) => {
                resolve()
            })
        })
    }

    saveState() {
        const state = this.getState()
        chrome.tabs.sendMessage(this.tabId, { message: "set-item", key: "state", value: state.toJson() })
    }

    restoreState() {
        chrome.tabs.sendMessage(this.tabId, { message: "get-item", key: "state" }, null, ((response) => {
            const state = CodeSyncState.fromJson(response)
            this.sourceUrlElement.value = state.url
            this.syncEnabledElement.checked = state.isSyncEnabled
            this.autoplayEnabledElement.checked = state.isAutplayEnabled
            if (state.isSyncEnabled) {
                this.badgeOn()
            } else {
                this.badgeOff()
            }
        }).bind(this))
    }

    getState() {
        return new CodeSyncState(this.sourceUrlElement.value, this.syncEnabledElement.checked, this.autoplayEnabledElement.checked)
    }

    sendMessageUpdateState() {
        const state = this.getState()
        chrome.tabs.sendMessage(this.tabId, {
            message: "update-state",
            url: state.url,
            isSyncEnabled: state.isSyncEnabled,
            isAutoplayEnabled: state.isAutplayEnabled
        })
    }

    onSourceUrlChange() {
        if (this.syncEnabledElement.checked) {
            this.syncEnabledElement.checked = false
            this.onSyncEnabledChange()
        } else {
            this.saveState()
        }
    }

    onSyncEnabledChange() {
        this.saveState()
        this.sendMessageUpdateState()
        if (this.syncEnabledElement.checked) {
            this.badgeOn()
        } else {
            this.badgeOff()
        }
    }

    onAutoplayEnabledChange() {
        this.saveState()
        this.sendMessageUpdateState()
    }

    badgeOn() {
        chrome.action.setBadgeBackgroundColor({
            tabId: this.tabId,
            color: "#79d55d"
        })
        chrome.action.setBadgeText({
            tabId: this.tabId,
            text: "\u25b2"
        })
    }

    badgeOff() {
        chrome.action.setBadgeBackgroundColor({
            tabId: this.tabId,
            color: "#00000000"
        })
        chrome.action.setBadgeText({
            tabId: this.tabId,
            text: ""
        })
    }
}

const popup = new Popup()
popup.run()
