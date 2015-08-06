var Registry = require("../core/registry");
var ChannelTool = require("./tools/channelTool");
var MouseTool = require("./tools/mouseTool");
var Features = require("../core/features");
var PanTool = require("./tools/panTool");
var PanAndZoom = require("./PanAndZoom");
var SelectTool = require("./tools/selectTool");
var SimpleQueue = require("../utils/SimpleQueue");

class ViewManager {
    constructor(view) {
        this.view = view;
        let chan = new ChannelTool(Features.Channel);
        let pan = new PanTool();
        let sel = new SelectTool();
        let reference = this;
        this.view.setMouseDownFunction(this.constructMouseDownEvent(chan, pan, sel));
        this.view.setMouseUpFunction(this.constructMouseUpEvent(chan, pan, sel));
        this.view.setMouseMoveFunction(this.constructMouseMoveEvent(chan, pan, sel));
        this.updateQueue = new SimpleQueue(function(){
            reference.view.refresh();
        }, 20);
        this.view.setResizeFunction(function() {
            reference.updateGrid();
            reference.updateDevice(Registry.currentDevice);
        })
        let func = function(event) {
            reference.adjustZoom(event.deltaY, reference.getEventPosition(event));
        };
        this.view.setMouseWheelFunction(func);
        this.minZoom = .0001;
        this.maxZoom = 5;
    }

    addDevice(device, refresh = true) {
        this.view.addDevice(device);
        this.__addAllDeviceLayers(device, false);
        this.refresh(refresh);
    }

    __addAllDeviceLayers(device, refresh = true) {
        for (let i = 0; i < device.layers.length; i++) {
            let layer = device.layers[i];
            this.addLayer(layer, i, false);
        }
    }

    __removeAllDeviceLayers(device, refresh = true) {
        for (let i = 0; i < device.layers.length; i++) {
            let layer = device.layers[i];
            this.removeLayer(layer, i, false);
        }
    }

    removeDevice(device, refresh = true) {
        this.view.removeDevice(device);
        this.__removeAllDeviceLayers(device, false);
        this.refresh(refresh);
    }

    updateDevice(device, refresh = true) {
        this.view.updateDevice(device);
        this.refresh(refresh);
    }

    addFeature(feature, refresh = true) {
        if (this.__isFeatureInCurrentDevice(feature)) {
            this.view.addFeature(feature);
            this.refresh(refresh);
        }
    }

    updateFeature(feature, refresh = true) {
        if (this.__isFeatureInCurrentDevice(feature)) {
            this.view.updateFeature(feature);
            this.refresh(refresh);
        }
    }

    removeFeature(feature, refresh = true) {
        if (this.__isFeatureInCurrentDevice(feature)) {
            this.view.removeFeature(feature);
            this.refresh(refresh);
        }
    }

    addLayer(layer, index, refresh = true) {
        if (this.__isLayerInCurrentDevice(layer)) {
            this.view.addLayer(layer, index, false);
            this.__addAllLayerFeatures(layer, false);
            this.refresh(refresh);
        }
    }

    updateLayer(layer, index, refresh = true) {
        if (this.__isLayerInCurrentDevice(layer)) {
            this.view.updateLayer(layer);
            this.refresh(refresh);
        }
    }

    removeLayer(layer, index, refresh = true) {
        if (this.__isLayerInCurrentDevice(layer)) {
            this.view.removeLayer(layer, index);
            this.__removeAllLayerFeatures(layer);
            this.refresh(refresh);
        }
    }

    __addAllLayerFeatures(layer, refresh = true) {
        for (let key in layer.features) {
            let feature = layer.features[key];
            this.addFeature(feature, false);
            this.refresh(refresh)
        }
    }

    __removeAllLayerFeatures(layer, refresh = true) {
        for (let key in layer.features) {
            let feature = layer.features[key];
            this.removeFeature(feature, false);
            this.refresh(refresh);
        }
    }

    updateLayer(layer, refresh = true) {
        if (this.__isCurrentDevice(device)) {
            this.view.updateLayer(layer);
            this.refresh(refresh);
        }
    }

    removeGrid(refresh = true) {
        if (this.__hasCurrentGrid()) {
            this.view.removeGrid();
            this.refresh(refresh);
        }
    }

    updateGrid(refresh = true) {
        if (this.__hasCurrentGrid()) {
            this.view.updateGrid(Registry.currentGrid);
            this.refresh(refresh);
        }
    }

    setZoom(zoom, refresh = true) {
        this.view.setZoom(zoom);
        this.updateGrid(false);
        this.updateDevice(Registry.currentDevice, false);
        this.refresh(refresh);
    }

    adjustZoom(delta, point, refresh = true) {
        let belowMin = (this.view.getZoom() >= this.maxZoom && delta < 0);
        let aboveMax = (this.view.getZoom() <= this.minZoom && delta > 0);
        if (!aboveMax && !belowMin) {
            this.view.adjustZoom(delta, point);
            this.updateGrid(false);
            this.updateDevice(Registry.currentDevice, false);
        } else {
            //console.log("Too big or too small!");
        }
        this.refresh(refresh);
    }

    setCenter(center, refresh = true) {
        this.view.setCenter(center);
        this.updateGrid(false);
        this.updateDevice(Registry.currentDevice, false);
        this.refresh(refresh);
    }

    moveCenter(delta, refresh = true) {
        this.view.moveCenter(delta);
        this.updateGrid(false);
        this.updateDevice(Registry.currentDevice, false);
        this.refresh(refresh);
    }

    refresh(refresh = true) {
        //this.view.refresh();
        this.updateQueue.run();
    }

    getEventPosition(event) {
        return this.view.getProjectPosition(event.clientX, event.clientY);
    }

    __hasCurrentGrid() {
        if (Registry.currentGrid) return true;
        else return false;
    }

    __isLayerInCurrentDevice(layer) {
        if (Registry.currentDevice && layer.device == Registry.currentDevice) return true;
        else return false;
    }

    __isFeatureInCurrentDevice(feature) {
        if (Registry.currentDevice && this.__isLayerInCurrentDevice(feature.layer)) return true;
        else return false;
    }

    constructMouseDownEvent(tool1, tool2, tool3) {
        return this.constructMouseEvent(tool1.down, tool2.down, tool3.down);
    }

    constructMouseMoveEvent(tool1, tool2, tool3) {
        return this.constructMouseEvent(tool1.move, tool2.move, tool3.move);
    }

    constructMouseUpEvent(tool1, tool2, tool3) {
        return this.constructMouseEvent(tool1.up, tool2.up, tool3.up);
    }

    static __eventButtonsToWhich(num){
        if (num == 1){
            return 1;
        } else if (num ==2){
            return 3;
        } else if (num == 4){
            return 2;
        } else if (num == 3){
            return 2;
        }
    }

    constructMouseEvent(func1, func2, func3) {
        return function(event) {
            let target;
            if (event.buttons){
                target = ViewManager.__eventButtonsToWhich(event.buttons);
            } else {
                target = event.which;
            }
            if (target == 2) func2(event);
            else if (target == 3) func3(event);
            else if(target == 1 || target == 0) func1(event);
        }
    }

    snapToGrid(point) {
        if (Registry.currentGrid) return Registry.currentGrid.getClosestGridPoint(point);
        else return point;
    }

    hitFeature(point){
        return this.view.hitFeature(point);
    }

    hitFeaturesWithPaperElement(element){
        return this.view.hitFeaturesWithPaperElement(element);
    }
}

module.exports = ViewManager;