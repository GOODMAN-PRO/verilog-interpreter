module t; parameter [15:0] W = "ab"; parameter S = "hi";
initial begin
$display({"a%d", "b"}, 5);
$display({S, "!"});
$display("x", W);
$display(W, 9);
end endmodule
