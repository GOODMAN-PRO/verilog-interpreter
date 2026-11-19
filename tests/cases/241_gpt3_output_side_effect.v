module top;
  function f(input x);
    begin $display("called"); f = x; end
  endfunction
  initial $display(f(1) ? "A" : "B");
endmodule
