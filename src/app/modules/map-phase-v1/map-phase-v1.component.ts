import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ModalModule,
  ButtonModule,
  CardModule,
  GridModule,
  TableModule,
} from '@coreui/angular';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import {
  cilMap,
  cilLocationPin,
  cilPin,
  cilBuilding,
  cilCursor,
} from '@coreui/icons';
import { AutoCompleteModule } from 'primeng/autocomplete';
import * as Cesium from 'cesium';

@Component({
  selector: 'app-map-phase-v1',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalModule,
    ButtonModule,
    CardModule,
    GridModule,
    TableModule,
    AutoCompleteModule,
    IconModule,
  ],
  templateUrl: './map-phase-v1.component.html',
  styleUrl: './map-phase-v1.component.scss',
})
export class MapPhaseV1Component implements AfterViewInit, OnDestroy {
  viewer!: Cesium.Viewer;
  private geoserverUrl = 'http://192.168.88.217:6080/geoserver';
  private workspace = 'thailand-demo';

  constructor(private iconSetService: IconSetService) {
    this.iconSetService.icons = {
      cilMap,
      cilLocationPin,
      cilPin,
      cilBuilding,
      cilCursor,
    };
  }

  private layers = {
    openStreetMap: null as Cesium.ImageryLayer | null,
    googleSatellite: null as Cesium.ImageryLayer | null,
    provinceBoundaries: null as Cesium.ImageryLayer | null,
    districtBoundaries: null as Cesium.ImageryLayer | null,
    subDistrictBoundaries: null as Cesium.ImageryLayer | null,
    roads: null as Cesium.ImageryLayer | null,
    waterways: null as Cesium.ImageryLayer | null,
  };

  layerControls = {
    openStreetMap: false,
    googleSatellite: false,
    provinceBoundaries: false,
    districtBoundaries: false,
    subDistrictBoundaries: false,
    roads: false,
    waterways: false,
  };

  panelCollapsed = true;

  searchQuery: any;
  suggestions: any[] = [];
  searchTimeout: any;

  selectedFeature: any = null;
  modalVisible = false;
  private handler: Cesium.ScreenSpaceEventHandler | null = null;

  fieldLabels: { [key: string]: string } = {
    PROV_NAMT: 'ชื่อจังหวัด (ไทย)',
    PROV_NAME: 'ชื่อจังหวัด (อังกฤษ)',
    Area_km2_: 'พื้นที่ (ตร.กม.)',
    AMP_NAME_T: 'ชื่ออำเภอ (ไทย)',
    AMP_NAME_E: 'ชื่ออำเภอ (อังกฤษ)',
    P_NAME_T: 'ชื่อจังหวัด (ไทย)',
    P_NAME_E: 'ชื่อจังหวัด (อังกฤษ)',
    A_NAME_T: 'ชื่ออำเภอ (ไทย)',
    A_NAME_E: 'ชื่ออำเภอ (อังกฤษ)',
    T_NAME_T: 'ชื่อตำบล (ไทย)',
    T_NAME_E: 'ชื่อตำบล (อังกฤษ)',
    Shape_Leng: 'ความยาวขอบเขต',
    Shape_Area: 'พื้นที่',
    NAME: 'ชื่อ',
    name: 'ชื่อ',
  };

  togglePanel() {
    this.panelCollapsed = !this.panelCollapsed;
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

    this.setupTier0_Globe();
    this.setupTier1_Terrain();
    this.setupTier2_Imagery();
    this.setupTier3_VectorFeatures();
    this.setupInteraction();

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 2000000),
    });
  }

  setupTier0_Globe() {
    console.log('✓ Tier 0: Globe (Ellipsoid) initialized');
  }

  setupTier1_Terrain() {
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    console.log('✓ Tier 1: Terrain (Ellipsoid) initialized');
  }

  setupTier2_Imagery() {
    console.log('✓ Tier 2: Using Cesium default base map (Bing Maps)');

    try {
      const provider = new Cesium.OpenStreetMapImageryProvider({
        url: 'https://a.tile.openstreetmap.org/',
      });
      this.layers.openStreetMap =
        this.viewer.imageryLayers.addImageryProvider(provider);
      this.layers.openStreetMap.show = this.layerControls.openStreetMap;
      console.log('✓ Tier 2: OpenStreetMap loaded (optional)');
    } catch (error) {
      console.error('✗ Error loading OSM:', error);
    }

    try {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        credit: 'Google Maps Satellite',
      });
      this.layers.googleSatellite =
        this.viewer.imageryLayers.addImageryProvider(provider);
      this.layers.googleSatellite.show = this.layerControls.googleSatellite;
      console.log('✓ Tier 2: Google Maps Satellite loaded');
    } catch (error) {
      console.error('✗ Error loading Google Maps:', error);
    }
  }

  setupTier3_VectorFeatures() {
    console.log(
      '⚠️ Tier 3: Using WMS (Phase 1) - Should migrate to WFS in Phase 2'
    );

    const wmsUrl = `${this.geoserverUrl}/wms`;
    this.layers.provinceBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:th_province`,
      'Province Boundaries'
    );

    this.layers.districtBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:thailand-amphoe`,
      'District Boundaries'
    );

    this.layers.subDistrictBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:thailand-tambon`,
      'SubDistrict Boundaries'
    );

    this.layers.roads = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_roads`,
      'Roads'
    );

    this.layers.waterways = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_waterways`,
      'Waterways'
    );
  }

  private addWMSLayer(
    url: string,
    layers: string,
    name: string
  ): Cesium.ImageryLayer | null {
    try {
      const provider = new Cesium.WebMapServiceImageryProvider({
        url,
        layers,
        parameters: {
          transparent: true,
          format: 'image/png',
          styles: '',
          INFO_FORMAT: 'application/json',
        },
      });
      const layer = this.viewer.imageryLayers.addImageryProvider(provider);
      layer.show = false;
      console.log(`✓ Tier 3: ${name} loaded (WMS)`);
      return layer;
    } catch (error) {
      console.error(`✗ Error loading ${name}:`, error);
      return null;
    }
  }

  toggleOpenStreetMap() {
    if (this.layers.openStreetMap) {
      this.layers.openStreetMap.show = this.layerControls.openStreetMap;
    }
  }

  toggleGoogleSatellite() {
    if (this.layers.googleSatellite) {
      this.layers.googleSatellite.show = this.layerControls.googleSatellite;
    }
  }

  toggleProvinceBoundaries() {
    if (this.layers.provinceBoundaries) {
      this.layers.provinceBoundaries.show =
        this.layerControls.provinceBoundaries;
    }
  }

  toggleDistrictBoundaries() {
    if (this.layers.districtBoundaries) {
      this.layers.districtBoundaries.show =
        this.layerControls.districtBoundaries;
    }
  }

  toggleSubDistrictBoundaries() {
    if (this.layers.subDistrictBoundaries) {
      this.layers.subDistrictBoundaries.show =
        this.layerControls.subDistrictBoundaries;
    }
  }

  toggleRoads() {
    if (this.layers.roads) {
      this.layers.roads.show = this.layerControls.roads;
    }
  }

  toggleWaterways() {
    if (this.layers.waterways) {
      this.layers.waterways.show = this.layerControls.waterways;
    }
  }

  async search(event: any) {
    const query = event.query;
    if (!query || query.trim().length === 0) {
      this.suggestions = [];
      return;
    }

    try {
      this.suggestions = await this.searchGeoServer(query);
    } catch (error) {
      console.error('Search error:', error);
      this.suggestions = [];
    }
  }

  async searchGeoServer(query: string): Promise<any[]> {
    const results: any[] = [];

    try {
      const provinceResults = await this.searchLayer(
        `${this.workspace}:th_province`,
        query,
        'province',
        'PROV_NAMT',
        'PROV_NAME'
      );
      results.push(...provinceResults);

      const districtResults = await this.searchLayer(
        `${this.workspace}:thailand-amphoe`,
        query,
        'district',
        'AMP_NAME_T',
        'AMP_NAME_E'
      );
      results.push(...districtResults);

      const subDistrictResults = await this.searchLayer(
        `${this.workspace}:thailand-tambon`,
        query,
        'subdistrict',
        'T_NAME_T',
        'T_NAME_E'
      );
      results.push(...subDistrictResults);

      const poiResults = await this.searchLayer(
        `${this.workspace}:gis_osm_pois`,
        query,
        'poi',
        'name',
        'name'
      );
      results.push(...poiResults);
    } catch (error) {
      console.error('GeoServer search error:', error);
    }

    return results.slice(0, 10);
  }

  async searchLayer(
    layerName: string,
    query: string,
    type: string,
    thField: string,
    enField: string
  ): Promise<any[]> {
    try {
      const wfsUrl = `${this.geoserverUrl}/wfs`;
      const filter = `${thField} LIKE '%${query}%' OR ${enField} LIKE '%${query}%'`;

      const params = new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: layerName,
        outputFormat: 'application/json',
        CQL_FILTER: filter,
        maxFeatures: '5',
        srsName: 'EPSG:4326',
      });

      const fullUrl = `${wfsUrl}?${params.toString()}`;
      console.log('🔍 Search Request:', {
        layerName,
        query,
        filter,
        url: fullUrl,
      });

      const response = await fetch(fullUrl);

      console.log('📡 Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ WFS Error Response:', errorText);
        throw new Error(`WFS request failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📦 WFS Response Data:', data);

      if (!data.features || data.features.length === 0) {
        console.warn('⚠️ No features found for query:', query);
        return [];
      }

      console.log(`✅ Found ${data.features.length} features`);

      return data.features.map((feature: any) => {
        const props = feature.properties;
        const geometry = feature.geometry;

        console.log('📄 Feature properties:', props);
        let longitude = 0;
        let latitude = 0;
        let height = 50000;
        if (geometry.type === 'Point') {
          [longitude, latitude] = geometry.coordinates;
        } else if (geometry.type === 'Polygon') {
          const coords = geometry.coordinates[0];
          longitude =
            coords.reduce((sum: number, c: any) => sum + c[0], 0) /
            coords.length;
          latitude =
            coords.reduce((sum: number, c: any) => sum + c[1], 0) /
            coords.length;
          height = type === 'province' ? 200000 : 100000;
        } else if (geometry.type === 'MultiPolygon') {
          const coords = geometry.coordinates[0][0];
          longitude =
            coords.reduce((sum: number, c: any) => sum + c[0], 0) /
            coords.length;
          latitude =
            coords.reduce((sum: number, c: any) => sum + c[1], 0) /
            coords.length;
          height = type === 'province' ? 200000 : 100000;
        }
        const nameTh = props[thField] || '';
        const nameEn = props[enField] || '';
        const displayName = nameTh || nameEn;

        console.log(`📌 Parsed: ${displayName} at (${longitude}, ${latitude})`);

        return {
          name: displayName,
          nameTh,
          nameEn,
          type,
          typeLabel: this.getTypeLabel(type),
          longitude,
          latitude,
          height,
          icon: this.getTypeIcon(type),
        };
      });
    } catch (error) {
      console.error(`❌ Error searching ${layerName}:`, error);
      return [];
    }
  }

  getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      province: 'จังหวัด',
      district: 'อำเภอ',
      subdistrict: 'ตำบล',
      poi: 'สถานที่',
    };
    return labels[type] || type;
  }

  getTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      province: 'cil-map',
      district: 'cil-location-pin',
      subdistrict: 'cil-pin',
      poi: 'cil-building',
    };
    return icons[type] || 'cil-cursor';
  }

  selectSearchResult(event: any) {
    const result = event.value;
    if (!result) return;

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude,
        result.height
      ),
      duration: 2,
    });

    console.log('Flying to:', result.name, result);
  }

  clearSearch() {
    this.searchQuery = null;
    this.suggestions = [];
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.viewer?.destroy();
    if (this.handler) {
      this.handler.destroy();
    }
  }

  setupInteraction() {
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.handler.setInputAction(async (movement: any) => {
      const ray = this.viewer.camera.getPickRay(movement.position);
      if (!ray) return;

      const pickedFeatures = this.viewer.imageryLayers.pickImageryLayerFeatures(
        ray,
        this.viewer.scene
      );

      if (!Cesium.defined(pickedFeatures)) {
        this.selectedFeature = null;
        return;
      }

      try {
        const features = await Promise.resolve(pickedFeatures);

        if (features && features.length > 0) {
          const feature: any = features[0];

          let properties = feature.properties;
          if (!properties && feature.data && feature.data.properties) {
            properties = feature.data.properties;
          } else if (!properties && feature.data) {
            properties = feature.data;
          }

          this.selectedFeature = {
            properties: properties || {},
            name: feature.name,
          };
          this.modalVisible = true;
        } else {
          this.selectedFeature = null;
        }
      } catch (error) {
        console.error('❌ Error picking features:', error);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  handleModalChange(event: boolean) {
    this.modalVisible = event;
  }

  getLabel(key: any): string {
    return this.fieldLabels[String(key)] || String(key);
  }

  getDisplayItems(): { key: string; value: any; label: string }[] {
    if (!this.selectedFeature?.properties) return [];

    const entries = Object.entries(this.selectedFeature.properties).map(
      ([key, value]) => ({
        key,
        value,
        label: this.getLabel(key),
      })
    );
    return entries.sort((a, b) => {
      if (a.key === 'Area_km2_') return 1;
      if (b.key === 'Area_km2_') return -1;
      return 0;
    });
  }
}
