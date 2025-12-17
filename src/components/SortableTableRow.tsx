import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EditableCell from './EditableCell';

interface SortableTableRowProps {
  id: string;
  design: any;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  inventoryType: 'rental' | 'purchase';
}

export function SortableTableRow({ id, design, onUpdate, onDelete, inventoryType }: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-gray-50' : ''}>
      {/* 드래그 핸들 */}
      <TableCell className="w-8">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
      </TableCell>
      
      {/* 상품코드 */}
      <TableCell>
        <EditableCell
          value={design.design_code}
          type="text"
          onSave={(value) => onUpdate(design.id, 'design_code', value)}
        />
      </TableCell>
      
      {/* 디자인명 */}
      <TableCell>
        <EditableCell
          value={design.design_name}
          type="text"
          onSave={(value) => onUpdate(design.id, 'design_name', value)}
        />
      </TableCell>
      
      {/* 사이즈 */}
      <TableCell>
        <EditableCell
          value={design.size}
          type="text"
          onSave={(value) => onUpdate(design.id, 'size', value)}
        />
      </TableCell>
      
      {/* 가격 */}
      <TableCell>
        <EditableCell
          value={design.rental_price}
          type="number"
          onSave={(value) => onUpdate(design.id, 'rental_price', Number(value))}
        />
      </TableCell>
      
      {/* 총 수량 */}
      <TableCell>
        <EditableCell
          value={design.total_quantity}
          type="number"
          onSave={(value) => onUpdate(design.id, 'total_quantity', Number(value))}
        />
      </TableCell>
      
      {inventoryType === 'rental' ? (
        <>
          {/* 대여가능 (주간 기준) */}
          <TableCell>
            <Badge className="bg-green-100 text-green-800">
              {design.weekly_available_quantity !== undefined ? design.weekly_available_quantity : design.available_quantity || 0}개
            </Badge>
          </TableCell>
          
          {/* 대여중 (주간 기준) */}
          <TableCell>
            <Badge className="bg-orange-100 text-orange-800">
              {design.weekly_rented_quantity !== undefined ? design.weekly_rented_quantity : design.rented_quantity || 0}개
            </Badge>
          </TableCell>
        </>
      ) : (
        <>
          {/* 판매됨 */}
          <TableCell>
            <Badge className="bg-red-50 text-red-400">{design.sold_quantity || 0}개</Badge>
          </TableCell>
          
          {/* 출고완료 */}
          <TableCell>
            <Badge className="bg-green-50 text-green-400">{design.shipped_quantity || 0}개</Badge>
          </TableCell>
          
          {/* ATS (판매가능) */}
          <TableCell>
            <Badge className="bg-blue-50 text-blue-400">{design.available_for_sale || 0}개</Badge>
          </TableCell>
          
          {/* 주문 필요량 */}
          <TableCell>
            {(() => {
              const orderRequired = design.order_required || Math.max((design.sold_quantity || 0) - design.total_quantity, 0);
              return (
                <Badge 
                  className={orderRequired > 0 ? "bg-red-100 text-red-800 font-bold" : "bg-gray-100 text-gray-600"}
                >
                  {orderRequired}개
                </Badge>
              );
            })()} 
          </TableCell>
        </>
      )}
      
      {/* 삭제 버튼 */}
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(design.id)}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}