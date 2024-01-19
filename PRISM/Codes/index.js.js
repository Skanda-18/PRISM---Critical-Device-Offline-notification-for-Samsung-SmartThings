const express = require('express');
const { SmartApp } = require('@smartthings/smartapp');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const port = 3000; // You can change the port as needed

// Replace 'YOUR_ACCESS_TOKEN' with the actual access token
const accessToken = 'f3199609-8467-4ff6-8182-67359c1dd5dc';

app.use(bodyParser.json());

const smartapp = new SmartApp()
  .enableEventLogging()
  .configureI18n()
  .page('mainPage', (context, page, configData) => {
    page.section('devices', section => {
      section.deviceSetting('selectedDevices')
        .capabilities(['healthCheck'])
        .multiple(true)
        .permissions('rx')
        .required(true);
    });
  })
  .updated(async (context, updateData) => {
    await context.api.subscriptions.delete();
    await context.api.subscriptions.subscribeToDevices(context.config.selectedDevices, 'healthCheck', 'deviceHealthEventHandler');

    // Log all devices
    if (context.config.selectedDevices.length > 0) {
      console.log('Checking status for devices:');
      context.config.selectedDevices.forEach(deviceId => {
        console.log(`- ${deviceId}`);
      });
    } else {
      console.log('No devices found.');
    }

    // Get the current status of each selected device
    const deviceStatusPromises = context.config.selectedDevices.map(async deviceId => {
      const deviceHealth = await context.api.devices.getCapabilityStatus(deviceId, 'healthCheck');
      return {
        deviceId,
        status: deviceHealth.value,
      };
    });

    const deviceStatuses = await Promise.all(deviceStatusPromises);

    // Check for offline devices and send notifications
    deviceStatuses.forEach(({ deviceId, status }) => {
      if (status !== 'online') {
        notifyUser(deviceId, status);
      }
    });
  })
  .subscribedEventHandler('deviceHealthEventHandler', (context, event) => {
    const deviceId = event.deviceId;
    const status = event.value;

    if (status !== 'online') {
      notifyUser(deviceId, status);
    }
  });

async function notifyUser(deviceId, status) {
  // Use SmartThings API to send push notification to the SmartThings app
  const pushNotificationUrl = `https://api.smartthings.com/v1/installedapps/${smartapp.installedAppId}/push`;
  
  try {
    await axios.post(pushNotificationUrl, {
      devices: [deviceId],
      lifecycle: 'PING',
      priority: 'HIGH',
      message: {
        key: 'device_offline',
        values: {
          deviceName: deviceId,
          status,
        },
      },
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    console.log(`Notification sent for device ${deviceId} with status ${status}`);
  } catch (error) {
    console.error('Error sending notification:', error.message);
  }
}

app.post('/smartthings', (req, res) => {
  smartapp.handleHttpCallback(req, res);
});

app.post('/', (req, res) => {
  smartapp.handleHttpCallback(req, res);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
