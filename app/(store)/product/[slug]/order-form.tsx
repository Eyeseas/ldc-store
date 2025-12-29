"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createOrder } from "@/lib/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";

const orderFormSchema = z.object({
  quantity: z.number().int().min(1),
  email: z.string().email("请输入有效的邮箱地址"),
  queryPassword: z
    .string()
    .min(6, "查询密码至少6位")
    .max(32, "查询密码最多32位"),
  confirmPassword: z.string(),
}).refine((data) => data.queryPassword === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

interface OrderFormProps {
  productId: string;
  productName: string;
  price: number;
  stock: number;
  minQuantity: number;
  maxQuantity: number;
}

export function OrderForm({
  productId,
  productName,
  price,
  stock,
  minQuantity,
  maxQuantity,
}: OrderFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const effectiveMax = Math.min(maxQuantity, stock);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      quantity: minQuantity,
      email: "",
      queryPassword: "",
      confirmPassword: "",
    },
  });

  const quantity = form.watch("quantity");
  const totalPrice = (price * quantity).toFixed(2);
  const errors = form.formState.errors;

  const updateQuantity = (delta: number) => {
    const newValue = quantity + delta;
    if (newValue >= minQuantity && newValue <= effectiveMax) {
      form.setValue("quantity", newValue);
    }
  };

  const onSubmit = (values: OrderFormValues) => {
    startTransition(async () => {
      const result = await createOrder({
        productId,
        quantity: values.quantity,
        email: values.email,
        queryPassword: values.queryPassword,
        paymentMethod: "ldc",
      });

      if (result.success) {
        toast.success("订单创建成功", {
          description: `订单号: ${result.orderNo}`,
        });

        if (result.paymentForm) {
          const form = document.createElement("form");
          form.method = "POST";
          form.action = result.paymentForm.actionUrl;
          form.style.display = "none";

          Object.entries(result.paymentForm.params).forEach(([key, value]) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = value;
            form.appendChild(input);
          });

          document.body.appendChild(form);
          form.submit();
        } else {
          router.push(`/order/result?orderNo=${result.orderNo}`);
        }
      } else {
        toast.error("下单失败", {
          description: result.message,
        });
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Quantity */}
      <div className="space-y-2">
        <Label>数量</Label>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-md border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => updateQuantity(-1)}
              disabled={quantity <= minQuantity}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              className="h-9 w-14 border-0 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= minQuantity && val <= effectiveMax) {
                  form.setValue("quantity", val);
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => updateQuantity(1)}
              disabled={quantity >= effectiveMax}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">
            限购 {minQuantity}-{effectiveMax} 件
          </span>
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">联系邮箱</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          {...form.register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
        <p className="text-xs text-muted-foreground">用于接收卡密信息</p>
      </div>

      {/* Password */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="queryPassword">查询密码</Label>
          <Input
            id="queryPassword"
            type="password"
            placeholder="6-32位密码"
            {...form.register("queryPassword")}
          />
          {errors.queryPassword && (
            <p className="text-sm text-destructive">{errors.queryPassword.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">确认密码</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="再次输入"
            {...form.register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      {/* Total & Submit */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <span className="text-sm text-muted-foreground">{productName} × {quantity}</span>
          <div className="text-xl font-bold">¥{totalPrice}</div>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              处理中
            </>
          ) : (
            "立即购买"
          )}
        </Button>
      </div>
    </form>
  );
}
