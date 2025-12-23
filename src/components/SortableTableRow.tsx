import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EditableCell from './EditableCell';
<<<<<<< HEAD
=======
import { useAuth } from '@/contexts/AuthContext';
>>>>>>> subin

interface SortableTableRowProps {
  id: string;
  design: any;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  inventoryType: 'rental' | 'purchase';
<<<<<<< HEAD
}

export function SortableTableRow({ id, design, onUpdate, onDelete, inventoryType }: SortableTableRowProps) {
=======
  readonly?: boolean;
}

export function SortableTableRow({ id, design, onUpdate, onDelete, inventoryType, readonly = false }: SortableTableRowProps) {
  const { role } = useAuth();
>>>>>>> subin
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
<<<<<<< HEAD
  } = useSortable({ id });
=======
  } = useSortable({ id, disabled: readonly });
>>>>>>> subin

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

<<<<<<< HEAD
=======
  const canEdit = !readonly;
  const canViewTotal = role === 'admin' || role === 'manager'; // Admin/Manager can see total qty
  // Note: RentalInventory passes 'readonly' based on role. Staff -> readonly=true.

  // Logic for display:
  // If readonly, EditableCell should be just text.

>>>>>>> subin
  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-gray-50' : ''}>
      {/* 드래그 핸들 */}
      <TableCell className="w-8">
<<<<<<< HEAD
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
=======
        {!readonly && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        )}
>>>>>>> subin
      </TableCell>
      
      {/* 상품코드 */}
      <TableCell>
<<<<<<< HEAD
        <EditableCell
          value={design.design_code}
          type="text"
          onSave={(value) => onUpdate(design.id, 'design_code', value)}
        />
=======
        {canEdit ? (
          <EditableCell
            value={design.design_code}
            type="text"
            onSave={(value) => onUpdate(design.id, 'design_code', value)}
          />
        ) : (
          design.design_code
        )}
>>>>>>> subin
      </TableCell>
      
      {/* 디자인명 */}
      <TableCell>
<<<<<<< HEAD
        <EditableCell
          value={design.design_name}
          type="text"
          onSave={(value) => onUpdate(design.id, 'design_name', value)}
        />
=======
        {canEdit ? (
          <EditableCell
            value={design.design_name}
            type="text"
            onSave={(value) => onUpdate(design.id, 'design_name', value)}
          />
        ) : (
          design.design_name
        )}
>>>>>>> subin
      </TableCell>
      
      {/* 사이즈 */}
      <TableCell>
<<<<<<< HEAD
        <EditableCell
          value={design.size}
          type="text"
          onSave={(value) => onUpdate(design.id, 'size', value)}
        />
=======
        {canEdit ? (
          <EditableCell
            value={design.size}
            type="text"
            onSave={(value) => onUpdate(design.id, 'size', value)}
          />
        ) : (
          design.size
        )}
>>>>>>> subin
      </TableCell>
      
      {/* 가격 */}
      <TableCell>
<<<<<<< HEAD
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
=======
        {canEdit ? (
          <EditableCell
            value={design.rental_price}
            type="number"
            onSave={(value) => onUpdate(design.id, 'rental_price', Number(value))}
          />
        ) : (
          design.rental_price?.toLocaleString()
        )}
      </TableCell>
      
      {/* 총 수량 (Admin only, or per requirement) */}
      {(role === 'admin' || inventoryType === 'purchase') && (
        <TableCell>
          {canEdit ? (
            <EditableCell
              value={design.total_quantity}
              type="number"
              onSave={(value) => onUpdate(design.id, 'total_quantity', Number(value))}
            />
          ) : (
            design.total_quantity
          )}
        </TableCell>
      )}
>>>>>>> subin
      
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
<<<<<<< HEAD
            <Badge className="bg-red-50 text-red-400">{design.sold_quantity || 0}개</Badge>
          </TableCell>
          
          {/* 출고완료 */}
          <TableCell>
            <Badge className="bg-green-50 text-green-400">{design.shipped_quantity || 0}개</Badge>
          </TableCell>
          
          {/* ATS (판매가능) */}
          <TableCell>
            <Badge className="bg-blue-50 text-blue-400">{design.available_for_sale || 0}개</Badge>
=======
            {canEdit ? (
              <EditableCell
                value={design.sold_quantity ?? 0}
                type="number"
                onSave={(value) => onUpdate(design.id, 'sold_quantity', Math.max(0, Number(value)))}
              />
            ) : (
              <Badge className="bg-red-50 text-red-400">{design.sold_quantity || 0}개</Badge>
            )}
          </TableCell>
          
          {/* 출고완료 - Removed as per requirements, but keeping for purchase if needed? User said "Purchase Inventory -> Remove Shipped Complete" */}
          {/* <TableCell>
            <Badge className="bg-green-50 text-green-400">{design.shipped_quantity || 0}개</Badge>
          </TableCell> */}
          
          {/* ATS (판매가능) */}
          <TableCell>
            {(() => {
              const total = Number(design.total_quantity ?? 0);
              const sold = Number(design.sold_quantity ?? 0);
              const ats = Math.max(0, total - sold);
              return <Badge className="bg-blue-50 text-blue-400">{ats}개</Badge>;
            })()}
>>>>>>> subin
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
<<<<<<< HEAD
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
=======
      {canEdit && (
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
      )}
    </TableRow>
  );
}
>>>>>>> subin
