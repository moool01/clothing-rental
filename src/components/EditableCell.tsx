import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, X, Edit } from 'lucide-react';

interface EditableCellProps {
  value: any;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
  onSave: (newValue: any) => void;
  className?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({ 
  value, 
  type, 
  options = [], 
  placeholder,
  onSave, 
  className = '' 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div 
        className={`cursor-pointer hover:bg-gray-100 p-2 rounded min-h-[40px] flex items-center group ${className}`}
        onClick={() => setIsEditing(true)}
      >
        <span className="flex-1">{value || '-'}</span>
        <Edit className="h-3 w-3 opacity-0 group-hover:opacity-50 ml-2" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-1">
      {type === 'select' ? (
        <Select value={editValue} onValueChange={setEditValue}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyPress}
          className="h-8"
          autoFocus
        />
      )}
      <Button size="sm" variant="ghost" onClick={handleSave} className="h-8 w-8 p-0">
        <Check className="h-3 w-3 text-green-600" />
      </Button>
      <Button size="sm" variant="ghost" onClick={handleCancel} className="h-8 w-8 p-0">
        <X className="h-3 w-3 text-red-600" />
      </Button>
    </div>
  );
};

export default EditableCell;