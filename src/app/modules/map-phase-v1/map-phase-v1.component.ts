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
    provinceBoundaries: null as Cesium.GeoJsonDataSource | null,
    districtBoundaries: null as Cesium.GeoJsonDataSource | null,
    subDistrictBoundaries: null as Cesium.GeoJsonDataSource | null,
    roads: null as Cesium.GeoJsonDataSource | null,
    waterways: null as Cesium.GeoJsonDataSource | null,
    pois: null as Cesium.GeoJsonDataSource | null,
    thailand: null as Cesium.ImageryLayer | null,
  };

  private searchMarker: Cesium.Entity | null = null;

  layerControls = {
    openStreetMap: false,
    googleSatellite: false,
    provinceBoundaries: false,
    districtBoundaries: false,
    subDistrictBoundaries: false,
    roads: false,
    waterways: false,
    pois: false,
    thailand: false,
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

    // Remove Cesium Ion credit
    const creditContainer = this.viewer.cesiumWidget
      .creditContainer as HTMLElement;
    if (creditContainer) {
      creditContainer.style.display = 'none';
    }

    this.setupTier0_Globe();
    this.setupTier1_Terrain();
    this.setupTier2_Imagery();
    this.setupTier3_VectorFeatures();
    this.setupInteraction();
    this.setupZoomBasedVisibility();

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
    console.log('✓ Tier 3: Loading Vector Features (GeoJSON via WFS)');

    const wfsUrl = `${this.geoserverUrl}/wfs`;

    // Load vector layers
    this.addVectorLayer(
      wfsUrl,
      `${this.workspace}:th_province`,
      'provinceBoundaries',
      'Province Boundaries',
      {
        stroke: Cesium.Color.BLUE.withAlpha(0.8),
        strokeWidth: 2,
        fill: Cesium.Color.BLUE.withAlpha(0.1),
      }
    );

    this.addVectorLayer(
      wfsUrl,
      `${this.workspace}:thailand-amphoe`,
      'districtBoundaries',
      'District Boundaries',
      {
        stroke: Cesium.Color.GREEN.withAlpha(0.7),
        strokeWidth: 1.5,
        fill: Cesium.Color.GREEN.withAlpha(0.05),
      }
    );

    this.addVectorLayer(
      wfsUrl,
      `${this.workspace}:thailand-tambon`,
      'subDistrictBoundaries',
      'SubDistrict Boundaries',
      {
        stroke: Cesium.Color.ORANGE.withAlpha(0.6),
        strokeWidth: 1,
        fill: Cesium.Color.ORANGE.withAlpha(0.03),
      }
    );

    this.addVectorLayer(
      wfsUrl,
      `${this.workspace}:gis_osm_roads`,
      'roads',
      'Roads',
      {
        stroke: Cesium.Color.YELLOW.withAlpha(0.8),
        strokeWidth: 2,
        fill: Cesium.Color.TRANSPARENT,
      }
    );

    this.addVectorLayer(
      wfsUrl,
      `${this.workspace}:gis_osm_waterways`,
      'waterways',
      'Waterways',
      {
        stroke: Cesium.Color.CYAN.withAlpha(0.7),
        strokeWidth: 2,
        fill: Cesium.Color.TRANSPARENT,
      }
    );

    this.addVectorLayer(
      wfsUrl,
      `${this.workspace}:gis_osm_pois`,
      'pois',
      'POIs',
      {
        markerSize: 32,
        markerColor: Cesium.Color.RED,
      }
    );

    // Keep thailand as WMS for base map
    const wmsUrl = `${this.geoserverUrl}/wms`;
    this.layers.thailand = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:thailand`,
      'Open Street Map (Self)'
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

  private async addVectorLayer(
    wfsUrl: string,
    layerName: string,
    layerKey: keyof typeof this.layers,
    displayName: string,
    style: {
      stroke?: Cesium.Color;
      strokeWidth?: number;
      fill?: Cesium.Color;
      markerSize?: number;
      markerColor?: Cesium.Color;
    }
  ) {
    try {
      const params = new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: layerName,
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
      });

      const fullUrl = `${wfsUrl}?${params.toString()}`;
      console.log(`Loading vector layer: ${displayName} from ${fullUrl}`);

      const dataSource = await Cesium.GeoJsonDataSource.load(fullUrl, {
        stroke: style.stroke || Cesium.Color.WHITE,
        strokeWidth: style.strokeWidth || 2,
        fill: style.fill || Cesium.Color.WHITE.withAlpha(0.1),
        markerSize: style.markerSize || 24,
        markerColor: style.markerColor || Cesium.Color.RED,
      });

      this.viewer.dataSources.add(dataSource);
      dataSource.show = false; // Hide by default

      // Store the dataSource in the layers object
      (this.layers as any)[layerKey] = dataSource;

      console.log(`✓ Tier 3: ${displayName} loaded (Vector/GeoJSON)`);
    } catch (error) {
      console.error(`✗ Error loading ${displayName}:`, error);
      (this.layers as any)[layerKey] = null;
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

  togglePOIs() {
    if (this.layers.pois) {
      this.layers.pois.show = this.layerControls.pois;
    }
  }

  toggleThailand() {
    if (this.layers.thailand) {
      this.layers.thailand.show = this.layerControls.thailand;
    }
  }

  async search(event: any) {
    const query = event.query;
    console.log('🔎 Search triggered with query:', query);

    if (!query || query.trim().length === 0) {
      console.log('⚠️ Empty query, clearing suggestions');
      this.suggestions = [];
      return;
    }

    try {
      this.suggestions = await this.searchGeoServer(query);
      console.log(
        `✅ Search completed: ${this.suggestions.length} results found`,
        this.suggestions
      );
    } catch (error) {
      console.error('❌ Search error:', error);
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

    // Remove previous search marker if exists
    if (this.searchMarker) {
      this.viewer.entities.remove(this.searchMarker);
      this.searchMarker = null;
    }

    // Create new pin marker at the selected location
    this.searchMarker = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude
      ),
      billboard: {
        image: this.createPinIcon(),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: result.name,
        font: '14pt sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, 10),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });

    // Fly to the location
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

  private createPinIcon(): string {
    // Create a simple pin icon using SVG
    const svg = `
      <svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 0c-9.8 0-17.7 7.8-17.7 17.4 0 15.5 17.7 30.6 17.7 30.6s17.7-15.4 17.7-30.6c0-9.6-7.9-17.4-17.7-17.4z"
              fill="#e74c3c" stroke="#c0392b" stroke-width="2"/>
        <circle cx="24" cy="17" r="6" fill="white"/>
      </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  setupZoomBasedVisibility() {
    this.viewer.camera.changed.addEventListener(() => {
      const cameraHeight = this.viewer.camera.positionCartographic.height;

      // Province boundaries: show when far away (high altitude) AND user toggled it on
      if (this.layers.provinceBoundaries) {
        this.layers.provinceBoundaries.show =
          this.layerControls.provinceBoundaries && cameraHeight > 500000;
      }

      // District boundaries: show at medium altitude AND user toggled it on
      if (this.layers.districtBoundaries) {
        this.layers.districtBoundaries.show =
          this.layerControls.districtBoundaries &&
          cameraHeight < 800000 &&
          cameraHeight > 100000;
      }

      // Sub-district boundaries: show when closer AND user toggled it on
      if (this.layers.subDistrictBoundaries) {
        this.layers.subDistrictBoundaries.show =
          this.layerControls.subDistrictBoundaries &&
          cameraHeight < 300000 &&
          cameraHeight > 50000;
      }

      // Roads: show only when very close AND user toggled it on
      if (this.layers.roads) {
        this.layers.roads.show =
          this.layerControls.roads && cameraHeight < 100000;
      }

      // Waterways: show when moderately close AND user toggled it on
      if (this.layers.waterways) {
        this.layers.waterways.show =
          this.layerControls.waterways && cameraHeight < 150000;
      }

      // POIs: show only when very close AND user toggled it on
      if (this.layers.pois) {
        this.layers.pois.show = this.layerControls.pois && cameraHeight < 50000;
      }
    });
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
