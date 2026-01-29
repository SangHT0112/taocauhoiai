// components/protected/ProtectedContent.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { getExercisesByUser } from "@/lib/services/exerciseService";
import { UserProvider } from "@/app/providers/UserProvider"; // điều chỉnh đường dẫn nếu cần

interface ProtectedContentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode; // optional: có thể hiển thị loading/skeleton thay vì redirect
}

export default async function ProtectedContent({
  children,
  fallback,
}: ProtectedContentProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    redirect("/login");
    // hoặc return fallback nếu muốn hiển thị UI thay vì redirect
  }

  let userId: number;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    userId = decoded.userId;
  } catch (err) {
    redirect("/login");
  }

  // Fetch data cần cho Sidebar (nếu Sidebar vẫn dùng)
  const exercises = await getExercisesByUser(userId);

  return (
    <UserProvider userId={userId}>
      {/* Truyền exercises xuống nếu Sidebar cần props */}
      {/* Hoặc nếu Sidebar dùng useContext để lấy userId → không cần truyền */}
      {children}
    </UserProvider>
  );
}