// @refresh reset
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// Define the User Profile interface based on Firestore schema
export interface UserProfile {
  uid: string;
  fullName: string;
  role: 'admin' | 'manager' | 'cashier' | 'ticket_checker';
  positions: string[]; // Các vị trí được phép đăng ký ca
  type: 'full_time' | 'part_time';
  hourlyRate: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfile({
              uid: currentUser.uid,
              fullName: data.name || 'Người dùng',
              role: data.role || 'cashier',
              positions: data.positions || [data.role || 'cashier'],
              type: data.type || 'full_time',
              hourlyRate: data.hourlyRate || 30000
            });
          } else {
            console.warn("User Document không tồn tại... Tiến hành tạo tự động cho Admin đầu tiên.");
            
            // Auto grant admin if it's the specific email or fallback
            const isAdmin = currentUser.email === 'truonghyminh@gmail.com' || currentUser.email === 'admin@gmail.com' || currentUser.email === 'admin@hba.vn';
            const defaultRole = isAdmin ? 'admin' : 'cashier';
            const defaultPositions = isAdmin ? ['manager', 'cashier', 'ticket_checker'] : ['cashier'];
            
            const newDocData = {
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              email: currentUser.email,
              role: defaultRole,
              positions: defaultPositions,
              type: 'full_time',
              hourlyRate: 30000,
              status: 'active',
              createdAt: new Date().toISOString()
            };

            // Lưu trực tiếp xuống Firestore db
            await setDoc(doc(db, 'users', currentUser.uid), newDocData);

            setProfile({
              uid: currentUser.uid,
              fullName: newDocData.name,
              role: newDocData.role as 'admin'|'manager'|'cashier'|'ticket_checker',
              positions: newDocData.positions,
              type: 'full_time',
              hourlyRate: 30000
            });
          }
        } catch (error) {
          console.error("Error fetching user profile", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-gray-500 font-medium">Đang kết nối hệ thống...</div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
