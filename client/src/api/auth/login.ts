import api from "@/api";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";

type LoginUserType = {
    username: string;
    password: string;
};

export async function loginUser(data: LoginUserType) {
    const response = await api.post("/auth/login", data);
    return response.data;
}

export const useLoginUser = () => {
    // const queryClient = useQueryClient();
    const navigate = useNavigate();

    return useMutation({
        mutationFn: loginUser,
        onSuccess: () => {
            navigate("/");
        },
    });
};
