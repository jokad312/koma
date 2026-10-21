import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Link, usePathname et useRouter qui connaissent le préfixe de langue.
export const { Link, usePathname, useRouter, redirect } = createNavigation(routing);
