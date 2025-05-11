const apiKey = '2ed00325aef9ade5eef0860441d6a996';
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('currentLocationBtn');
const unitSelect = document.getElementById('unit-select');

let globalForecastData = null;
let favorites = JSON.parse(localStorage.getItem('favoriteCities')) || [];

async function fetchWeather(location, unit = 'metric') {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${location}&units=${unit}&appid=${apiKey}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${location}&units=${unit}&appid=${apiKey}`;
    
    const [currentRes, forecastRes] = await Promise.all([
      fetch(url),
      fetch(forecastUrl)
    ]);

    if (!currentRes.ok || !forecastRes.ok) {
      throw new Error('City not found. Please check the spelling and try again.');
    }
    
    const [current, forecast] = await Promise.all([
      currentRes.json(),
      forecastRes.json()
    ]);

    updateUI(current, forecast);
    cityInput.value = current.name; // Update input with correct city name
  } catch (error) {
    console.error('Error:', error);
    alert(error.message);
  }
}

function fetchCurrentLocationWeather() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords;
        const unit = unitSelect.value;
        try {
          const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${apiKey}`;
          const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${unit}&appid=${apiKey}`;
          
          const [currentRes, forecastRes] = await Promise.all([
            fetch(url),
            fetch(forecastUrl)
          ]);

          if (!currentRes.ok || !forecastRes.ok) throw new Error('Failed to fetch weather data');
          
          const [current, forecast] = await Promise.all([
            currentRes.json(),
            forecastRes.json()
          ]);

          updateUI(current, forecast);
        } catch (error) {
          console.error('Error:', error);
          alert('Failed to fetch weather data');
        }
      },
      () => {
        alert('Location access denied. Showing default city.');
        fetchWeather('London', unitSelect.value);
      }
    );
  } else {
    alert('Geolocation not supported. Showing default city.');
    fetchWeather('London', unitSelect.value);
  }
}

// Update the UI with weather data
function updateUI(current, forecast) {
  globalForecastData = forecast;
  
  // Update metrics grid with more elements
  const metricsContainer = document.getElementById('metricsContainer');
  const metrics = [
    { icon: '🌡️', label: 'Feels Like', value: `${Math.round(current.main.feels_like)}°` },
    { icon: '💧', label: 'Humidity', value: `${current.main.humidity}%` },
    { icon: '💨', label: 'Wind', value: `${current.wind.speed} m/s` },
    { icon: '🌅', label: 'Sunrise', value: formatTime(current.sys.sunrise) },
    { icon: '🌇', label: 'Sunset', value: formatTime(current.sys.sunset) },
    { icon: '🌊', label: 'Pressure', value: `${current.main.pressure} hPa` },
    { icon: '👁️', label: 'Visibility', value: `${(current.visibility / 1000).toFixed(1)} km` },
    { icon: '🧭', label: 'Wind Dir', value: getWindDirection(current.wind.deg) },
    { icon: '💨', label: 'Gust', value: `${current.wind.gust || 0} m/s` },
    { icon: '☁️', label: 'Clouds', value: `${current.clouds.all}%` }
  ];
  
  metricsContainer.innerHTML = metrics.map(m => `
    <div class="metric-item">
      <i>${m.icon}</i>
      ${m.label}<br>${m.value}
    </div>
  `).join('');

  // Update current weather
  document.getElementById('nowTemp').textContent = `${Math.round(current.main.temp)}°`;
  document.getElementById('nowDesc').textContent = current.weather[0].description;
  document.getElementById('nowDate').textContent = `📅 ${new Date().toDateString()}`;
  document.getElementById('nowLocation').textContent = `📍 ${current.name}, ${current.sys.country}`;

  // Update map
  document.getElementById('mapFrame').src = 
    `https://maps.google.com/maps?q=${current.coord.lat},${current.coord.lon}&z=12&output=embed`;

  // Update forecast days
  const forecastContainer = document.getElementById('forecastContainer');
  if (!forecastContainer) return;

  const dailyForecasts = forecast.list.filter((item, index) => index % 8 === 0);
  
  const forecastHTML = dailyForecasts.map((day, index) => `
    <div class="forecast-day" data-index="${index}">
      <div class="forecast-day-content">
        ${getWeatherEmoji(day.weather[0].main)} 
        <span class="temp">${Math.round(day.main.temp)}°</span>
        <span>${new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  `).join('');
  
  forecastContainer.innerHTML = forecastHTML;

  // Add click handlers for forecast days
  document.querySelectorAll('.forecast-day').forEach(day => {
    day.addEventListener('click', () => {
      document.querySelectorAll('.forecast-day').forEach(d => d.classList.remove('active'));
      day.classList.add('active');
      const index = parseInt(day.dataset.index);
      updateDayDetails(forecast, index);
    });
  });

  // Update current data
  updateChartData(current);
  updateClimateData(current, forecast);
  
  // Click first forecast day by default
  const firstDay = document.querySelector('.forecast-day');
  if (firstDay) firstDay.click();
}

function getWeatherEmoji(condition) {
  const emojis = {
    'Clear': '☀️',
    'Clouds': '☁️',
    'Rain': '🌧️',
    'Snow': '❄️',
    'Thunderstorm': '⛈️',
    'Drizzle': '🌦️',
    'Mist': '🌫️',
    'Fog': '🌫️',
    'Haze': '🌫️'
  };
  return emojis[condition] || '🌡️';
}

function updateDayDetails(forecast, dayIndex) {
  const startIndex = dayIndex * 8;
  const dayData = forecast.list.slice(startIndex, startIndex + 8);
  
  // Update hourly chart
  updateForecastChart(dayData);
  
  // Update pie chart
  const weatherCounts = dayData.reduce((acc, hour) => {
    const type = hour.weather[0].main;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const chart = document.querySelector('.chart');
  const total = Object.values(weatherCounts).reduce((a, b) => a + b, 0);
  const getPercent = count => (count / total) * 360;

  chart.style.background = `conic-gradient(
    #ff6e42 0deg ${getPercent(weatherCounts.Rain || 0)}deg,
    #00c0ff ${getPercent(weatherCounts.Rain || 0)}deg ${getPercent(weatherCounts.Rain || 0) + getPercent(weatherCounts.Clear || 0)}deg,
    #c5a3ff ${getPercent(weatherCounts.Rain || 0) + getPercent(weatherCounts.Clear || 0)}deg 360deg
  )`;

  // Update monthly stats based on selected day
  const selectedDate = new Date(dayData[0].dt * 1000);
  document.getElementById('chartMonth').textContent = selectedDate.toLocaleString('default', { month: 'long' });
  document.getElementById('chartYear').textContent = selectedDate.getFullYear();

  // Calculate day statistics
  const temps = dayData.map(hour => hour.main.temp);
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const sunnyHours = dayData.filter(hour => hour.weather[0].main === 'Clear').length;
  const rainyHours = dayData.filter(hour => ['Rain', 'Drizzle', 'Thunderstorm'].includes(hour.weather[0].main)).length;

  // Update stats display
  document.getElementById('sunDays').textContent = sunnyHours;
  document.getElementById('rainDays').textContent = rainyHours;
  document.getElementById('avgHigh').textContent = `${Math.round(maxTemp)}°`;
  document.getElementById('avgLow').textContent = `${Math.round(minTemp)}°`;
}

function updateChartData(current) {
  const date = new Date();
  document.getElementById('chartYear').textContent = date.getFullYear();
  document.getElementById('chartMonth').textContent = date.toLocaleString('default', { month: 'long' });
  
  // Update monthly stats
  document.getElementById('sunDays').textContent = Math.floor(Math.random() * 10 + 15);
  document.getElementById('rainDays').textContent = Math.floor(Math.random() * 5 + 5);
  document.getElementById('avgHigh').textContent = `${Math.round(current.main.temp_max)}°`;
  document.getElementById('avgLow').textContent = `${Math.round(current.main.temp_min)}°`;
}

function updateDayStats(dayData) {
  // Calculate weather distribution for pie chart
  const weatherCounts = dayData.reduce((acc, hour) => {
    const type = hour.weather[0].main;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  // Update pie chart colors based on weather distribution
  const chart = document.querySelector('.chart');
  const total = Object.values(weatherCounts).reduce((a, b) => a + b, 0);
  const getPercent = count => (count / total) * 360;

  chart.style.background = `conic-gradient(
    #ff6e42 0deg ${getPercent(weatherCounts.Rain || 0)}deg,
    #00c0ff ${getPercent(weatherCounts.Rain || 0)}deg ${getPercent(weatherCounts.Rain || 0) + getPercent(weatherCounts.Clear || 0)}deg,
    #c5a3ff ${getPercent(weatherCounts.Rain || 0) + getPercent(weatherCounts.Clear || 0)}deg 360deg
  )`;
}

// Generate a graph based on hourly temperature data
function generateGraph(hourlyData) {
  const labels = hourlyData.map((hour) => new Date(hour.dt_txt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const temperatures = hourlyData.map((hour) => hour.main.temp);

  const canvas = document.createElement('canvas');
  chartContainer.innerHTML = ''; // Clear previous graph
  chartContainer.appendChild(canvas);

  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Hourly Temperature',
        data: temperatures,
        borderColor: '#c5a3ff',
        backgroundColor: 'rgba(197, 163, 255, 0.2)',
        borderWidth: 2,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { title: { display: true, text: 'Time' } },
        y: { title: { display: true, text: 'Temperature' } },
      },
    },
  });
}

function updateClimateData(current, forecast) {
  const forecastData = forecast.list;
  const temps = forecastData.map(item => item.main.temp);
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const lat = current.coord.lat;
  const lon = current.coord.lon;

  // Check if location is in India (rough boundaries)
  const isIndia = (lat >= 8 && lat <= 37 && lon >= 68 && lon <= 97);
  
  const climateInfo = {
    hottest: {
      month: isIndia ? 'April' : (lat > 0 ? 'July' : 'January'),
      value: `${Math.round(maxTemp + (isIndia ? 2 : 0))}°`
    },
    coldest: {
      month: isIndia ? 'January' : (lat > 0 ? 'January' : 'July'),
      value: `${Math.round(minTemp)}°`
    },
    wettest: {
      month: isIndia ? 'July' : 'June', // Monsoon season in India
      value: `${Math.round(current.main.humidity * 1.2)}mm`
    },
    windiest: {
      month: isIndia ? 'June' : 'March', // Pre-monsoon in India
      value: `${Math.round(current.wind.speed * 1.5)} m/s`
    },
    sunniest: {
      month: isIndia ? 'May' : 'June',
      value: `${Math.round((1 - current.clouds.all/100) * 320)}h`
    }
  };

  // Update table cells
  document.getElementById('hotAll').innerHTML = 
    `${climateInfo.hottest.month} <span class="value">${climateInfo.hottest.value}</span>`;
  document.getElementById('coldAll').innerHTML = 
    `${climateInfo.coldest.month} <span class="value">${climateInfo.coldest.value}</span>`;
  document.getElementById('wetAll').innerHTML = 
    `${climateInfo.wettest.month} <span class="value">${climateInfo.wettest.value}</span>`;
  document.getElementById('windAll').innerHTML = 
    `${climateInfo.windiest.month} <span class="value">${climateInfo.windiest.value}</span>`;
  document.getElementById('sunAll').innerHTML = 
    `${climateInfo.sunniest.month} <span class="value">${climateInfo.sunniest.value}</span>`;
}

function getWindDirection(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function updateForecastChart(dayData) {
  const ctx = document.getElementById('hourlyChart');
  if (!ctx) return;

  // Clear any existing chart
  if (window.hourlyChart instanceof Chart) {
    window.hourlyChart.destroy();
  }

  const hourlyLabels = dayData.map(hour => new Date(hour.dt * 1000).toLocaleTimeString([], { hour: '2-digit' }));
  const hourlyTemps = dayData.map(hour => Math.round(hour.main.temp));
  const hourlyIcons = dayData.map(hour => getWeatherEmoji(hour.weather[0].main));

  window.hourlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hourlyLabels,
      datasets: [{
        label: 'Temperature',
        data: hourlyTemps,
        borderColor: '#c5a3ff',
        backgroundColor: 'rgba(197, 163, 255, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 600
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(28, 23, 58, 0.9)',
          padding: 12,
          callbacks: {
            label: (context) => `${hourlyIcons[context.dataIndex]} ${context.formattedValue}°`
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#aaa', font: { size: 12 } }
        },
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          ticks: { color: '#aaa', font: { size: 12 } }
        }
      }
    }
  });

  // Update hourly details
  const hourlyDetails = document.querySelector('.hourly-details');
  if (hourlyDetails) {
    hourlyDetails.innerHTML = dayData.map(hour => `
      <div class="hour-item">
        <div class="hour-time">${new Date(hour.dt * 1000).toLocaleTimeString([], { hour: '2-digit' })}</div>
        <div class="hour-icon">${getWeatherEmoji(hour.weather[0].main)}</div>
        <div class="hour-temp">${Math.round(hour.main.temp)}°</div>
      </div>
    `).join('');
  }
}

// Add these new functions
function saveFavorite() {
    const city = document.getElementById('cityInput').value;
    if (city && !favorites.includes(city)) {
        favorites.push(city);
        localStorage.setItem('favoriteCities', JSON.stringify(favorites));
        updateFavoritesDropdown();
    }
}

function updateFavoritesDropdown() {
    const select = document.getElementById('favorites');
    select.innerHTML = '<option value="">Favorite Cities</option>';
    favorites.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        select.appendChild(option);
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchCurrentLocationWeather();
  
  const searchBtn = document.getElementById('searchBtn');
  const cityInput = document.getElementById('cityInput');
  const unitSelect = document.getElementById('unit-select');
  
  // Add search on button click
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const city = cityInput.value.trim();
      if (city) fetchWeather(city, unitSelect.value);
    });
  }

  // Add search on Enter key
  cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const city = cityInput.value.trim();
      if (city) fetchWeather(city, unitSelect.value);
    }
  });

  // Update when unit changes
  unitSelect.addEventListener('change', () => {
    const city = cityInput.value.trim();
    if (city) {
      fetchWeather(city, unitSelect.value);
    } else {
      fetchCurrentLocationWeather();
    }
  });

  updateFavoritesDropdown();
    
  document.getElementById('addFavorite').addEventListener('click', saveFavorite);
    
  document.getElementById('favorites').addEventListener('change', function() {
    if (this.value) {
        document.getElementById('cityInput').value = this.value;
        fetchWeatherData(this.value);
    }
  });
});
