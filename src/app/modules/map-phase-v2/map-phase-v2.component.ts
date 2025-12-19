import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalModule, ButtonModule, CardModule, GridModule, TableModule } from '@coreui/angular';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import { cilMap, cilLocationPin, cilPin, cilBuilding, cilCursor, cilChevronRight, cilChevronBottom } from '@coreui/icons';
import { AutoCompleteModule } from 'primeng/autocomplete';
import * as Cesium from 'cesium';

@Component({
    selector: 'app-map-phase-v2',
    standalone: true,
    imports: [CommonModule, FormsModule, ModalModule, ButtonModule, CardModule, GridModule, TableModule, AutoCompleteModule, IconModule],
    templateUrl: './map-phase-v2.component.html',
    styleUrl: './map-phase-v2.component.scss',
})
export class MapPhaseV2Component implements AfterViewInit, OnDestroy {
    viewer!: Cesium.Viewer;
    private geoserverUrl = 'http://192.168.88.217:6080/geoserver';
    private workspace = 'thailand-demo';

    // การเก็บข้อมูล Imagery Layers (Raster)
    layers = {
        openStreetMap: null as Cesium.ImageryLayer | null,
        googleSatellite: null as Cesium.ImageryLayer | null,
        openStreetMapSelf: null as Cesium.ImageryLayer | null,
        roads: null as Cesium.ImageryLayer | null,
        waterways: null as Cesium.ImageryLayer | null,
        buildings: null as Cesium.ImageryLayer | null,
    };

    // การเก็บข้อมูล DataSources (Vector/WFS) สำหรับการ Interact
    private vectorSources = {
        province: null as Cesium.GeoJsonDataSource | null,
        district: null as Cesium.GeoJsonDataSource | null,
        subDistrict: null as Cesium.GeoJsonDataSource | null,
        pois: null as Cesium.GeoJsonDataSource | null,
    };

    // สถานะการเปิด-ปิด Layer รายย่อย
    layerControls = {
        openStreetMap: false,
        googleSatellite: false,
        openStreetMapSelf: true,
        provinceBoundaries: true,
        districtBoundaries: true,
        subDistrictBoundaries: true,
        roads: true,
        waterways: true,
        pois: true,
        buildings: false,
    };

    // สถานะการเปิด-ปิด และ Collapse ของ Tier
    tierControls = {
        tier0: true,
        tier1: false,
        tier2: true,
        tier3: true,
        tier4: false,
    };

    tierCollapsed = {
        tier0: true,
        tier1: true,
        tier2: false,
        tier3: false,
        tier4: true,
    };

    panelCollapsed = false;
    searchQuery: any;
    suggestions: any[] = [];
    selectedFeature: any = null;
    modalVisible = false;
    currentCameraHeight: number = 2000000;

    private handler: Cesium.ScreenSpaceEventHandler | null = null;
    private pinEntity: Cesium.Entity | null = null;
    private cameraChangeListener: any = null;

    // เกณฑ์ระดับความสูงสำหรับการทำ LOD (เมตร)
    private zoomLevels = {
        country: 400000, // ระดับประเทศ
        region: 100000, // ระดับจังหวัด
        city: 25000, // ระดับอำเภอ/ตำบล
        neighborhood: 5000, // ระดับ POI
        street: 1500, // ระดับสิ่งปลูกสร้าง
    };

    // ป้ายชื่อฟิลด์ภาษาไทย
    fieldLabels: { [key: string]: string } = {
        PROV_NAMT: 'ชื่อจังหวัด (ไทย)',
        PROV_NAME: 'ชื่อจังหวัด (อังกฤษ)',
        AMP_NAME_T: 'ชื่ออำเภอ',
        T_NAME_T: 'ชื่อตำบล',
        NAME: 'ชื่อสถานที่',
        name: 'ชื่อสถานที่',
        Area_km2_: 'พื้นที่ (ตร.กม.)',
    };

    constructor(private iconSetService: IconSetService) {
        this.iconSetService.icons = { cilMap, cilLocationPin, cilPin, cilBuilding, cilCursor, cilChevronRight, cilChevronBottom };
    }

    ngAfterViewInit(): void {
        (window as any).CESIUM_BASE_URL = '/assets/cesium/';
        this.initCesium();
    }

    initCesium() {
        this.viewer = new Cesium.Viewer('cesiumContainer', {
            timeline: false,
            animation: false,
            baseLayerPicker: false,
            sceneModePicker: false,
            geocoder: false,
            homeButton: true,
            fullscreenButton: true,
            infoBox: false,
            selectionIndicator: false,
        });

        // ซ่อนเครดิตเริ่มต้น
        (this.viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

        // ตั้งค่า Tiers ตามลำดับ
        this.setupTier0_Globe();
        this.setupTier1_Terrain();
        this.setupTier2_Imagery();
        this.setupTier3_Vector();
        this.setupTier4_3D();

        this.setupInteraction();
        this.setupCameraListener();

        // ไปยังพิกัดเริ่มต้น (กรุงเทพฯ)
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 2000000),
        });
    }

    setupTier0_Globe() {
        this.viewer.scene.globe.show = this.tierControls.tier0;
    }

    setupTier1_Terrain() {
        // อนาคตสามารถเปลี่ยนเป็น URL ของ Terrain Server ได้
        this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }

    setupTier2_Imagery() {
        const wmsUrl = `${this.geoserverUrl}/wms`;

        // 1. OSM Self-hosted (WMS)
        this.layers.openStreetMapSelf = this.addWMSLayer(wmsUrl, `${this.workspace}:thailand`, 'OSM Self', 0);
        this.layers.openStreetMapSelf.show = this.layerControls.openStreetMapSelf;

        // 2. Google Satellite
        this.layers.googleSatellite = this.viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                credit: 'Google Maps Satellite',
            })
        );
        this.layers.googleSatellite.show = this.layerControls.googleSatellite;

        // 3. OSM Public
        this.layers.openStreetMap = this.viewer.imageryLayers.addImageryProvider(
            new Cesium.OpenStreetMapImageryProvider({ url: 'https://a.tile.openstreetmap.org/' })
        );
        this.layers.openStreetMap.show = this.layerControls.openStreetMap;
    }

    async setupTier3_Vector() {
        const wmsUrl = `${this.geoserverUrl}/wms`;

        // ข้อมูลเส้นทาง (แสดงเป็นภาพเพื่อประสิทธิภาพ)
        this.layers.waterways = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_waterways`, 'Waterways', 1);
        this.layers.roads = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_roads`, 'Roads', 2);

        // ข้อมูลขอบเขตและ POI (โหลดเป็น WFS/GeoJSON เพื่อให้คลิกได้)
        await this.loadWFSVector(`${this.workspace}:th_province`, 'province');
        await this.loadWFSVector(`${this.workspace}:thailand-amphoe`, 'district');
        await this.loadWFSVector(`${this.workspace}:thailand-tambon`, 'subDistrict');
        await this.loadWFSVector(`${this.workspace}:gis_osm_pois`, 'pois');

        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    setupTier4_3D() {
        const wmsUrl = `${this.geoserverUrl}/wms`;
        this.layers.buildings = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_buildings_a`, 'Buildings', 7);
    }

    // ฟังก์ชันช่วยโหลด WFS
    private async loadWFSVector(typeName: string, key: keyof typeof this.vectorSources) {
        const url = `${this.geoserverUrl}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${typeName}&outputFormat=application/json&srsName=EPSG:4326`;
        try {
            const dataSource = await Cesium.GeoJsonDataSource.load(url, {
                stroke: Cesium.Color.fromCssColorString('#1a73e8'),
                fill: Cesium.Color.fromAlpha(Cesium.Color.WHITE, 0.01),
                strokeWidth: 2,
            });
            this.viewer.dataSources.add(dataSource);
            this.vectorSources[key] = dataSource;
            dataSource.show = false;
        } catch (e) {
            console.error(`✗ ไม่สามารถโหลด WFS: ${typeName}`, e);
        }
    }

    // ฟังก์ชันช่วยโหลด WMS
    private addWMSLayer(url: string, layers: string, name: string, zIndex: number): Cesium.ImageryLayer {
        const provider = new Cesium.WebMapServiceImageryProvider({
            url,
            layers,
            parameters: { transparent: true, format: 'image/png' },
        });
        const layer = this.viewer.imageryLayers.addImageryProvider(provider);
        layer.show = false;
        return layer;
    }

    setupCameraListener() {
        this.cameraChangeListener = this.viewer.camera.changed.addEventListener(() => {
            this.currentCameraHeight = this.viewer.camera.positionCartographic.height;
            this.updateLayerVisibilityByZoom(this.currentCameraHeight);
        });
    }

    updateLayerVisibilityByZoom(height: number) {
        if (!this.tierControls.tier3) {
            Object.values(this.vectorSources).forEach((v) => v && (v.show = false));
            return;
        }

        // คุมการแสดงผลขอบเขตตามระดับความสูง (LOD)
        if (this.vectorSources.province) this.vectorSources.province.show = height > this.zoomLevels.country && this.layerControls.provinceBoundaries;
        if (this.vectorSources.district)
            this.vectorSources.district.show =
                height <= this.zoomLevels.country && height > this.zoomLevels.region && this.layerControls.districtBoundaries;
        if (this.vectorSources.subDistrict)
            this.vectorSources.subDistrict.show =
                height <= this.zoomLevels.region && height > this.zoomLevels.city && this.layerControls.subDistrictBoundaries;

        // คุมการแสดงผลเลเยอร์รอง
        if (this.layers.roads) this.layers.roads.show = height < this.zoomLevels.city && this.layerControls.roads;
        if (this.layers.waterways) this.layers.waterways.show = height < this.zoomLevels.city && this.layerControls.waterways;
        if (this.vectorSources.pois) this.vectorSources.pois.show = height < this.zoomLevels.neighborhood && this.layerControls.pois;
        if (this.layers.buildings) this.layers.buildings.show = height < this.zoomLevels.street && this.layerControls.buildings;
    }

    setupInteraction() {
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction((movement: any) => {
            const pickedObject = this.viewer.scene.pick(movement.position);
            if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
                const entity = pickedObject.id;
                this.selectedFeature = { properties: entity.properties.getValue(Cesium.JulianDate.now()) };
                this.modalVisible = true;
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    // --- Search Implementation ---
    async search(event: any) {
        const query = event.query;
        if (!query) return;
        this.suggestions = await this.searchGeoServer(query);
    }

    async searchGeoServer(query: string): Promise<any[]> {
        const layersToSearch = [
            { name: `${this.workspace}:th_province`, label: 'จังหวัด', fTh: 'PROV_NAMT', fEn: 'PROV_NAME', type: 'province' },
            { name: `${this.workspace}:thailand-amphoe`, label: 'อำเภอ', fTh: 'AMP_NAME_T', fEn: 'AMP_NAME_E', type: 'district' },
            { name: `${this.workspace}:gis_osm_pois`, label: 'สถานที่', fTh: 'name', fEn: 'name', type: 'poi' },
        ];

        const results: any[] = [];
        for (const layer of layersToSearch) {
            const filter = `${layer.fTh} LIKE '%${query}%' OR ${layer.fEn} LIKE '%${query}%'`;
            const url = `${this.geoserverUrl}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${
                layer.name
            }&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(filter)}&maxFeatures=5`;

            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data.features) {
                    data.features.forEach((f: any) => {
                        results.push({
                            name: f.properties[layer.fTh] || f.properties[layer.fEn],
                            typeLabel: layer.label,
                            icon: layer.type === 'poi' ? 'cil-location-pin' : 'cil-map',
                            raw: f,
                        });
                    });
                }
            } catch (e) {
                console.error(e);
            }
        }
        return results;
    }

    selectSearchResult(event: any) {
        const feature = event.value.raw;
        let coords: number[] = [];
        if (feature.geometry.type === 'Point') {
            coords = feature.geometry.coordinates;
        } else {
            // คำนวณจุดกึ่งกลาง Polygon อย่างง่าย
            const ring = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates[0][0] : feature.geometry.coordinates[0];
            const sum = ring.reduce((acc: number[], curr: number[]) => [acc[0] + curr[0], acc[1] + curr[1]], [0, 0]);
            coords = [sum[0] / ring.length, sum[1] / ring.length];
        }

        if (this.pinEntity) this.viewer.entities.remove(this.pinEntity);
        this.pinEntity = this.viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1]),
            billboard: { image: 'assets/icons/pin.png', verticalOrigin: Cesium.VerticalOrigin.BOTTOM, scale: 0.5 },
        });

        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], 10000),
            duration: 2,
        });
    }

    // --- UI Handlers ---
    togglePanel() {
        this.panelCollapsed = !this.panelCollapsed;
    }
    toggleTier0() {
        this.viewer.scene.globe.show = this.tierControls.tier0;
    }
    handleModalChange(event: boolean) {
        this.modalVisible = event;
    }

    getModalTitle() {
        const p = this.selectedFeature?.properties;
        return p?.PROV_NAMT || p?.AMP_NAME_T || p?.T_NAME_T || p?.NAME || 'รายละเอียด';
    }

    getDisplayItems() {
        if (!this.selectedFeature?.properties) return [];
        return Object.entries(this.selectedFeature.properties).map(([key, value]) => ({
            label: this.fieldLabels[key] || key,
            value: value,
        }));
    }

    ngOnDestroy(): void {
        if (this.cameraChangeListener) this.cameraChangeListener();
        this.viewer?.destroy();
        this.handler?.destroy();
    }
}
