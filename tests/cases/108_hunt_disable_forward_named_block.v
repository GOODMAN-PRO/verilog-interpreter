module t;
initial begin
  $display("a");
  disable later;
  $display("b");
  begin : later $display("c"); end
end
endmodule
