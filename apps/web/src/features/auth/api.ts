import { api } from '../../lib/api';
import type { AuthResult } from '../../types';
import type { LoginValues, RegisterValues } from './schemas';

export async function login(values: LoginValues): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/login', values);
  return data;
}

export async function register(values: RegisterValues): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/register', values);
  return data;
}
