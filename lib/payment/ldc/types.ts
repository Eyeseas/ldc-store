export type RefundMode = "server" | "proxy" | "disabled";
export type PaymentProtocol = "epay" | "ldcpay";

export interface PaymentParams {
  pid: string;
  type: "epay";
  out_trade_no: string;
  name: string;
  money: string;
  notify_url?: string;
  return_url?: string;
  device?: string;
}

export interface LdcPayParams {
  client_id: string;
  type: "ldcpay";
  out_trade_no: string;
  money: string;
  order_name: string;
  notify_url?: string;
  return_url?: string;
}

export interface NotifyParams {
  pid: string;
  trade_no: string;
  out_trade_no: string;
  type: string;
  name: string;
  money: string;
  trade_status: string;
  sign_type: string;
  sign: string;
}

export interface OrderQueryResult {
  code: number;
  msg: string;
  trade_no: string;
  out_trade_no: string;
  type: string;
  pid: string;
  addtime: string;
  endtime: string;
  name: string;
  money: string;
  status: number;
}

export interface RefundResult {
  code: number;
  msg: string;
}

export interface PaymentFormData {
  actionUrl: string;
  params: Record<string, string>;
}
