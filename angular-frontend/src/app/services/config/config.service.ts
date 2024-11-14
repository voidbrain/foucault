// src/app/services/config.service.ts
import { Injectable } from '@angular/core';
import axios from 'axios';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configUrl = 'http://config-service:3004/config'; // URL to get config
  private updateConfigUrl = 'http://config-service:3004/update-config'; // URL to update config

  // Get PID config from the server
  async getConfig(): Promise<any> {
    try {
      const response = await axios.get(this.configUrl);
      return response.data;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }

  // Update PID config on the server
  async updateConfig(config: any): Promise<any> {
    try {
      const response = await axios.post(this.updateConfigUrl, config);
      return response.data;
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  }
}
