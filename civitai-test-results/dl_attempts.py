import urllib.request
import json

api_key = "12b71406df2ba5655e11aae36553d154"
urls = [
    "https://orchestration-new.civitai.com/v2/consumer/blobs/e2e45a07-7528-4742-9d65-9f8b5d8057c2-0.jpg?sig=CfDJ8OhuHddet6VHsmTPdSCkBZRUB3EwVt7T3OFLulU1nnL_xzV7mH9KTeFvRrT8dyFPnInn7ZqyUhxWnTKq5cPGcGeTNjDhI5grqEsWdXl94Vysh2vERYikJ-rZ6fSX404-0CswGoYOioSCAbiIVLlTyGuD7A25lN_gWzaBAgHfJbyvO6m7i_HmvUBe0QTNsLHuJtcGHtHG0C_vZuEfSq5_7nTUcvA2TZ95RlwIVj21k7DzBLFX8FkGRzXgm7TfcGHltTjNPtIIM0DxZIxVT_k6pBqVpykghKfsH8WARaI6ibGN_SNy2wwHjESraW5NlElHgg&exp=2027-08-04T20:15:00.0522038Z",
    "https://orchestration-new.civitai.com/v2/consumer/blobs/ad1ab0a8-eafc-4444-9594-dd321c872df2-0.jpg?sig=CfDJ8OhuHddet6VHsmTPdSCkBZTui-GCNygVT7DHzKTmhG9SfXMJcguKUH8Bo8x4DvybnOnKBgme7lKgZxr9ovT0H786_G6k0JoUkSibXuxQsjdVpdedA3lvF1gRdNViDIJyHuhdr6wuUyIn-Z-D8w_GTz-VdPPfoFg8dc3vJygowTZ_ci70W1mBykjkQtXyvdPsa8rdGeNGGEY0zX6mwXJ0TYA9p1ojQl8GQXFyFaulomketYdA3BcDW8OLffr-4vsDN-S2dxLCOPK1zc0Cb2PHYzTE0uLTkohT-FCi1M-F8YUwvdHkPnWRB5_RB2mDjMz8OQ&exp=2027-08-04T20:15:34.5294226Z",
    "https://orchestration-new.civitai.com/v2/consumer/blobs/613d7c37-2128-42cc-9181-047bb47603e2-0.jpg?sig=CfDJ8OhuHddet6VHsmTPdSCkBZRys4pmMmGt3oyHFcaquCIZ_H0J5FwCqTKN3h0XxKabr2fhXSg03UMlj-TFR5Z3Cy5UVCn91Jwnvss15e-evMfeqzbHebfA9TA45b-v3OqfGOiounxJWZ_QsKCboBtrFPrrpItE1TGMg-IYDghpcLqvzR63k4N3-cbTjUCVBtTTBN3w8AVh0udO7CeLLWeGQsmTURyHFvJOX3eKYJFAcm5dH-HdLTGEpBbDs1cps4gjq5Tajntva6ZT8WjfZ0wKwpzO5JuafTB0mrzU-e1k764DbU4v6CjEQUp1VgTkTS7bVg&exp=2027-08-04T20:17:06.6509825Z"
]

for i, u in enumerate(urls, 1):
    path = f"C:\\Users\\hebp\\OneDrive\\Desktop\\manager\\hops-and-honey-bar-manager-3d\\civitai-test-results\\attempt_{i}.jpg"
    urllib.request.urlretrieve(u, path)
    print(f"Saved attempt {i} to {path}")
