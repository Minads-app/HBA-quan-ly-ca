import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface CompanyInfo {
  companyName: string;
  logoBase64: string;   // base64-encoded image, max ~200KB
  slogan: string;
  address: string;
  phone: string;
}

const DEFAULT_COMPANY: CompanyInfo = {
  companyName: 'Hệ thống Quản lý',
  logoBase64: '',
  slogan: 'Ứng dụng Quản lý & Đăng ký Ca làm việc',
  address: '',
  phone: '',
};

export function useCompanyInfo() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'company_info'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompanyInfo({
          companyName: data.companyName || DEFAULT_COMPANY.companyName,
          logoBase64: data.logoBase64 || '',
          slogan: data.slogan || DEFAULT_COMPANY.slogan,
          address: data.address || '',
          phone: data.phone || '',
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { companyInfo, loading };
}
