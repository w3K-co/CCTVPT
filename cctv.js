// Let's do this...
var colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF', '#C0C0C0', '#808080', '#800000', '#808000', '#008000', '#800080', '#008080', '#000080', '#4B0082', '#7CFC00', '#ADFF2F', '#7FFF00', '#D2691E', '#8B4513', '#A52A2A', '#DEB887', '#5F9EA0', '#7F007F', '#D02090', '#FFD700', '#8B008B', '#556B2F', '#FF8C00', '#9932CC', '#8B0000', '#E9967A'];
var toolsEl = document.getElementById('tools');
var cameras = [];
var currentCam = null;

Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
}

/**
 * Build the coords for a polygon
 */
function buildPolyCoords(latlng, facingAngle, spanAngle, distMetres) {
    var pt1 = L.GeometryUtil.destination(latlng, facingAngle - (spanAngle / 2.0), distMetres);
    var pt2 = L.GeometryUtil.destination(latlng, facingAngle - (spanAngle / 4.0), distMetres);
    var pt3 = L.GeometryUtil.destination(latlng, facingAngle, distMetres);
    var pt4 = L.GeometryUtil.destination(latlng, facingAngle + (spanAngle / 4.0), distMetres);
    var pt5 = L.GeometryUtil.destination(latlng, facingAngle + (spanAngle / 2.0), distMetres);
    return [
        [latlng.lat, latlng.lng],
        [pt1.lat, pt1.lng],
        [pt2.lat, pt2.lng],
        [pt3.lat, pt3.lng],
        [pt4.lat, pt4.lng],
        [pt5.lat, pt5.lng],
    ];
}

/**
 * Add a camera at a given coordinate
 */
function addCamera(latlng) {
    var cam = {
        position: latlng,
        angle: 0,
        sensorSize: 6.43,   // mm diagional = 1/2.8"
        focalLength: 2.8,   // mm
        range: 30,          // metres
    };

    cam.fov = calcFov(cam.sensorSize, cam.focalLength);

    var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
    var ndPolygon = L.polygon(coords).addTo(map);

    var ndCentre = L.circle([cam.position.lat, cam.position.lng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.5,
        radius: 0.5
    }).addTo(map);

    ndPolygon.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });

    cam.ndPolygon = ndPolygon;
    cam.ndCentre = ndCentre;
    cameras.push(cam);

    setCurrent(cam);
}

function calcFov(sensorSize, focalLength) {
    return Math.degrees(2 * Math.atan(sensorSize / (2.0 * focalLength)));
}

/**
 * Set the current camera in the tools panel
 */
function setCurrent(cam) {
    var colorPaletteHtml = colors.map(color => `<div class="color-square" style="background-color: ${color};" onclick="changeColor('${color}')"></div>`).join('');

    toolsEl.innerHTML = `
        ${cam.position.lat}<br>${cam.position.lng}
        <br>
        Angle: <input type="range" min="-360" max="360" id="fld-angle" value="${cam.angle}"> degrees
        <br>
        <br>Sensor: ${cam.sensorSize}mm
        <br>Focal Len: ${cam.focalLength}mm
        <br>
        <br>Range: <input type="range" min="1" max="100" id="fld-range" value="${cam.range}"> meters
        <br>FOV: <input type="range" min="1" max="359" id="fld-fov" value="${cam.fov}"> degrees
        <br>
        <br>Color: <div id="color-palette">${colorPaletteHtml}</div>
    `;

    document.getElementById('fld-angle').addEventListener('input', (e) => { cam.angle = parseFloat(e.target.value); renderCam(cam) });
    document.getElementById('fld-range').addEventListener('input', (e) => { cam.range = parseFloat(e.target.value); renderCam(cam) });
    document.getElementById('fld-fov').addEventListener('input', (e) => { cam.fov = parseFloat(e.target.value); renderCam(cam) });

    currentCam = cam;
}



function changeColor(color) {
    if (currentCam) {
        currentCam.ndPolygon.setStyle({
            color: color,
            fillColor: color
        });
        currentCam.ndCentre.setStyle({
            color: color,
            fillColor: color
        });
    }
}


function renderCam(cam) {
    var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
    cam.ndPolygon.setLatLngs(coords);
}


function startMapCoords() {
    var urlParams = new URLSearchParams(window.location.search);
    var lat = urlParams.get('lat');
    var lng = urlParams.get('lng');
    var z = urlParams.get('z');
    if (lat && lng && z) {
        return [lat, lng, z];
    } else {
        return [26.528691713882818, -80.0643789768219, 18];
    }
}

function setUrlCoords(map) {
    var urlParams = new URLSearchParams(location.search);
    urlParams.set('lat', map.getCenter().lat);
    urlParams.set('lng', map.getCenter().lng);
    urlParams.set('z', map.getZoom());
    var newUrl = location.protocol + "//" + location.host + location.pathname + '?' + urlParams.toString();
    history.replaceState(null, '', newUrl);
}


// Function to remove the current camera
function removeCurrentCamera() {
    if (currentCam) {
        currentCam.ndPolygon.remove();
        currentCam.ndCentre.remove();
        cameras = cameras.filter(cam => cam !== currentCam);
        currentCam = null;
        toolsEl.innerHTML = '';
    }
}


// Initialize Program
function init() {
    // OpenStreetMap
    var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    // Google Satellite
    var sat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3'],
        attribution: '&copy; Google'
    });

    var coords = startMapCoords();
    var map = L.map('map', {
        center: [coords[0], coords[1]],
        zoom: coords[2],
        layers: [osm]
    });

    L.control.layers({
        "OpenStreetMap": osm,
        "Google Satellite": sat,
    }, {}).addTo(map);

    map.on('click', (e) => addCamera(e.latlng));
    map.on('moveend', (e) => setUrlCoords(map));

    window.map = map;
}


// Call 'saveState' whenever the state changes and monitor DEL key at the same time.
document.addEventListener('keydown', function(event) {
    if (event.key === 'Delete') {
        removeCurrentCamera();
    }
});


// Rock N Roll
init();
