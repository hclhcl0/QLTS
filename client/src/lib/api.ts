export const API_URL = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(response: Response, endpoint?: string) {
  if (response.status === 401) {
    if (endpoint && !endpoint.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || 'Tên đăng nhập hoặc mật khẩu không chính xác');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Lỗi kết nối API');
  }
  return data;
}

export async function apiGet(endpoint: string) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response, endpoint);
}

export async function apiPost(endpoint: string, body: any) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(response, endpoint);
}

export async function apiPostForm(endpoint: string, formData: FormData) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return handleResponse(response, endpoint);
}

export async function apiPut(endpoint: string, body: any) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(response, endpoint);
}

export async function apiDelete(endpoint: string) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response, endpoint);
}

export async function apiDownload(endpoint: string, fallbackFilename: string) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Phiên đăng nhập đã hết hạn');
  }
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || 'Không thể tải tệp xuất');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const fnMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i);
  let filename = fallbackFilename;
  if (fnMatch?.[1]) {
    try {
      filename = decodeURIComponent(fnMatch[1].trim());
    } catch {
      filename = fnMatch[1].trim();
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
