// src/app/services/config.service.ts
import { Injectable } from '@angular/core';
import axios from 'axios';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configUrl = 'http://foucault:3004/config'
  // 'http://config-service:3004/config'; // URL to get config

  // Get PID config from the server
  async getConfig(): Promise<any> {
    try {
      const response = await axios.get(this.configUrl, {
        withCredentials: true  // Include credentials (cookies, authorization headers, etc.)
      });
      console.log(response)
      return response.data;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }
}
