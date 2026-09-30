"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { PASSWORD_MIN_LENGTH, registerSchema, type RegisterInput } from "@task-time-tracker/shared";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyServerErrors } from "@/lib/forms/apply-server-errors";
import { useRegister } from "../use-auth";

export function RegisterForm() {
  const router = useRouter();
  const registerUser = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) =>
    registerUser.mutate(values, {
      onSuccess: () => router.push("/dashboard"),
      onError: (error) => applyServerErrors(error, setError),
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField id="name" label="Name" error={errors.name?.message}>
        <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
      </FormField>
      <FormField
        id="password"
        label={`Password (min. ${PASSWORD_MIN_LENGTH} characters)`}
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </FormField>
      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={registerUser.isPending}>
        {registerUser.isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
