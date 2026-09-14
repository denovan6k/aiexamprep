"use client";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

type OtpInputProps = {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
};

export function OtpInput({
  id,
  value = "",
  onChange,
  onBlur,
  name,
  disabled,
  className,
  "aria-invalid": ariaInvalid
}: OtpInputProps) {
  return (
    <InputOTP
      id={id}
      name={name}
      maxLength={6}
      value={value}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      autoComplete="one-time-code"
      inputMode="numeric"
      onBlur={onBlur}
      onChange={onChange}
      containerClassName={cn("justify-center sm:justify-start", className)}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}
