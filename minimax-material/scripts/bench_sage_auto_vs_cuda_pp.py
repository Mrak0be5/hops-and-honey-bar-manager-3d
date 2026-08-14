import time
import torch
from sageattention import sageattn, sageattn_qk_int8_pv_fp8_cuda

HEADS = 56
DIM = 128
WARM = 5
ITERS = 15
LAYOUT = "HND"


def video_tokens(length):
    latent_t = 2 if length <= 5 else ((length - 5) // 17) * 5 + 2
    return latent_t * 24 * 42


def bench(name, fn, q, k, v):
    for _ in range(WARM):
        fn(q, k, v)
    torch.cuda.synchronize()
    t0 = time.perf_counter()
    for _ in range(ITERS):
        fn(q, k, v)
    torch.cuda.synchronize()
    ms = (time.perf_counter() - t0) * 1000 / ITERS
    print(f"{name:18s}  {ms:8.2f} ms", flush=True)
    return ms


def auto_fn(q, k, v):
    return sageattn(q, k, v, tensor_layout=LAYOUT, is_causal=False, smooth_k=False)


def cuda_pp_fn(q, k, v):
    return sageattn_qk_int8_pv_fp8_cuda(
        q, k, v, tensor_layout=LAYOUT, is_causal=False, pv_accum_dtype="fp32+fp16"
    )


def cuda_fn(q, k, v):
    return sageattn_qk_int8_pv_fp8_cuda(
        q, k, v, tensor_layout=LAYOUT, is_causal=False, pv_accum_dtype="fp32+fp32"
    )


def main():
    cap = torch.cuda.get_device_capability(0)
    print("gpu", torch.cuda.get_device_name(0))
    print("arch sm" + str(cap[0]) + str(cap[1]))
    print("torch", torch.__version__, "cuda", torch.version.cuda)
    print("heads", HEADS, "dim", DIM, "layout", LAYOUT, "dtype bfloat16")
    print()

    for length, label in ((124, "5s"), (243, "10s")):
        n = video_tokens(length)
        print(f"=== MiniMax H3 {label} video tokens N={n} (1344x768, length={length}) ===")
        q = torch.randn(1, HEADS, n, DIM, device="cuda", dtype=torch.bfloat16)
        k = torch.randn(1, HEADS, n, DIM, device="cuda", dtype=torch.bfloat16)
        v = torch.randn(1, HEADS, n, DIM, device="cuda", dtype=torch.bfloat16)
        t_auto = bench("auto", auto_fn, q, k, v)
        t_pp = bench("cuda++", cuda_pp_fn, q, k, v)
        t_old = bench("fp8_cuda", cuda_fn, q, k, v)
        d = (t_auto - t_pp) / t_auto * 100
        print(f"cuda++ vs auto: {d:+.2f}%  (negative = cuda++ slower)")
        print(f"cuda++ vs fp8_cuda: {(t_old - t_pp) / t_old * 100:+.2f}%")
        print()
        del q, k, v
        torch.cuda.empty_cache()


if __name__ == "__main__":
    main()
