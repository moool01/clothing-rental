import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock } from 'lucide-react';

export const Login = () => {
  const { setRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string>('staff');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Simple mock authentication
    // In a real app, this would verify against a backend
    if (selectedRole === 'admin' && password !== 'admin1234') {
        setError('관리자 비밀번호가 일치하지 않습니다.');
        return;
    }
    if (selectedRole === 'manager' && password !== 'manager1234') {
        setError('실장 비밀번호가 일치하지 않습니다.');
        return;
    }

    // Staff allows any password or empty for now, or we can enforce one
    if (selectedRole === 'staff' && password !== 'staff1234') {
         setError('직원 비밀번호가 일치하지 않습니다.');
         return;
    }

    setRole(selectedRole as any);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
                <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-bold">시스템 로그인</CardTitle>
          <CardDescription className="text-center">
            접속하실 권한과 비밀번호를 입력해주세요
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">권한 선택</Label>
              <Select value={selectedRole} onValueChange={(v) => {
                  setSelectedRole(v);
                  setError('');
              }}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="권한을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">직원 (조회 전용)</SelectItem>
                  <SelectItem value="manager">실장 (재고/가격 관리)</SelectItem>
                  <SelectItem value="admin">관리자 (통계/승인)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                }}
                placeholder="비밀번호를 입력하세요"
              />
              <p className="text-xs text-muted-foreground">
                * 테스트용: staff1234, manager1234, admin1234
              </p>
            </div>
            {error && (
                <div className="text-sm text-red-500 text-center font-medium">
                    {error}
                </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">로그인</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
