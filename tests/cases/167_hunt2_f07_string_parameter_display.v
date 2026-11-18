module t;
parameter F = "v=%0d";
parameter G = "hello";
initial begin
  $display(G);
  $display(F, 5);
end
endmodule
