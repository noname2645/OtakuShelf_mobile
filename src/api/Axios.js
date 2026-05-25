import axios from 'axios';
import { API_BASE_URL, AXIOS_CONFIG } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  ...AXIOS_CONFIG,
});

export default api;

